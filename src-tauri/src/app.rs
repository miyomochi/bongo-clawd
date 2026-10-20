use crate::{
    input::InputService,
    preferences::{Point, Preferences, DECORATIONS_HEIGHT},
    resources, system,
};
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    Emitter, Manager, RunEvent, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

#[derive(Clone)]
pub struct Runtime {
    pub enabled: bool,
    pub running: bool,
    pub phase: String,
    pub detail: String,
}
#[derive(Default)]
pub struct Adjustments {
    pub settings: bool,
    pub accessory: bool,
    pub popup: bool,
    pub update: bool,
}
impl Adjustments {
    pub fn any(&self) -> bool {
        self.settings || self.accessory || self.popup || self.update
    }
}
pub struct AppState {
    pub prefs: Mutex<Preferences>,
    pub statistics: Mutex<crate::statistics::Statistics>,
    pub adjustments: Mutex<Adjustments>,
    pub runtime: Mutex<Runtime>,
    pub input: Mutex<Option<InputService>>,
    pub save: mpsc::Sender<SaveMessage>,
    pub save_thread: Mutex<Option<std::thread::JoinHandle<()>>>,
    pub quitting: AtomicBool,
    pub ready: AtomicBool,
    pub settings_opening: AtomicBool,
    pub last_menu: Mutex<Option<Instant>>,
    pub menu: Mutex<Option<Menu<tauri::Wry>>>,
    pub input_item: Mutex<Option<CheckMenuItem<tauri::Wry>>>,
    pub side_item: Mutex<Option<CheckMenuItem<tauri::Wry>>>,
    pub mirror_item: Mutex<Option<CheckMenuItem<tauri::Wry>>>,
    pub updater: Mutex<crate::update_service::UpdateRuntime>,
}
pub enum SaveMessage {
    Update(Preferences),
    Stop(Preferences),
}
fn save_file(path: &std::path::Path, prefs: &Preferences) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let temp = path.with_extension("tmp");
    std::fs::write(&temp, serde_json::to_vec(prefs)?)?;
    std::fs::rename(temp, path)
}
fn save_worker(path: PathBuf) -> (mpsc::Sender<SaveMessage>, std::thread::JoinHandle<()>) {
    let (tx, rx) = mpsc::channel::<SaveMessage>();
    let thread = std::thread::spawn(move || {
        let mut pending = None;
        loop {
            let next = if pending.is_some() {
                rx.recv_timeout(Duration::from_millis(180))
            } else {
                rx.recv().map_err(|_| mpsc::RecvTimeoutError::Disconnected)
            };
            match next {
                Ok(SaveMessage::Update(p)) => pending = Some(p),
                Ok(SaveMessage::Stop(p)) => {
                    let _ = save_file(&path, &p);
                    break;
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    if let Some(p) = pending.take() {
                        let _ = save_file(&path, &p);
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    if let Some(p) = pending {
                        let _ = save_file(&path, &p);
                    }
                    break;
                }
            }
        }
    });
    (tx, thread)
}
pub fn snapshot(app: &tauri::AppHandle) -> Value {
    let s = app.state::<AppState>();
    let p = s.prefs.lock().unwrap().clone();
    let r = s.runtime.lock().unwrap().clone();
    let a = s.adjustments.lock().unwrap();
    let mut value = serde_json::to_value(p).unwrap();
    let map = value.as_object_mut().unwrap();
    map.extend(json!({"enabled":r.enabled,"running":r.running,"phase":r.phase,"detail":r.detail,"platform":"win32","settingsOpen":a.settings,"accessoryOpen":a.accessory,"popupOpen":a.popup,"edition":"Beta · 更新功能不稳定","autostartEnabled":system::autostart_enabled(),"installed":system::installed(),"version":env!("CARGO_PKG_VERSION")}).as_object().unwrap().clone());
    value.as_object_mut().unwrap().insert("update".into(), serde_json::to_value(crate::update_service::view(app)).unwrap());
    value
}
pub fn publish(app: &tauri::AppHandle) {
    let s = app.state::<AppState>();
    if s.quitting.load(Ordering::Relaxed) {
        return;
    }
    let value = snapshot(app);
    let _ = app.emit_to("main", "clawd:state", value.clone());
    let _ = app.emit_to("settings", "clawd:state", value);
}
pub fn report(app: &tauri::AppHandle, running: bool, phase: &str, detail: &str) {
    {
        let s = app.state::<AppState>();
        let mut r = s.runtime.lock().unwrap();
        r.running = running;
        r.phase = phase.into();
        r.detail = detail.into();
    }
    publish(app);
}
fn authorize(window: &WebviewWindow, main_only: bool) -> Result<(), String> {
    let label = window.label();
    if label != "main" && (main_only || label != "settings") {
        return Err("Unexpected window".into());
    }
    let url = window.url().map_err(|e| e.to_string())?;
    if url.scheme() == "tauri"
        || ((url.scheme() == "http" || url.scheme() == "https")
            && url.host_str() == Some("tauri.localhost"))
    {
        Ok(())
    } else {
        Err("Unexpected origin".into())
    }
}
fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        resources::ensure_visible(&w);
        let _ = w.show();
        let _ = w.set_focus();
    }
}
fn configure_main(app: &tauri::AppHandle, p: &Preferences) -> Result<(), String> {
    let w = app
        .get_webview_window("main")
        .ok_or("Missing main window")?;
    let (width, mut height) = p.dimensions();
    if app
        .state::<AppState>()
        .adjustments
        .lock()
        .unwrap()
        .accessory
    {
        height += DECORATIONS_HEIGHT * p.scale;
    }
    w.set_size(tauri::LogicalSize::new(width.round(), height.round()))
        .map_err(|e| e.to_string())?;
    w.set_always_on_top(p.always_on_top)
        .map_err(|e| e.to_string())?;
    Ok(())
}
pub(crate) fn set_adjustment(app: &tauri::AppHandle, kind: &str, open: bool) -> Result<(), String> {
    let s = app.state::<AppState>();
    let adjusting = {
        let mut a = s.adjustments.lock().unwrap();
        match kind {
            "settings" => a.settings = open,
            "accessory" => a.accessory = open,
            "popup" => a.popup = open,
            "update" => a.update = open,
            _ => return Err("Unknown adjustment".into()),
        }
        a.any()
    };
    let enabled = s.runtime.lock().unwrap().enabled && !adjusting;
    if let Some(service) = s.input.lock().unwrap().as_ref() {
        service.set_enabled(enabled);
    }
    if kind == "accessory" {
        configure_main(app, &s.prefs.lock().unwrap().clone())?;
    }
    publish(app);
    Ok(())
}
fn apply(app: &tauri::AppHandle, patch: &Value) -> Result<Value, String> {
    let s = app.state::<AppState>();
    let (previous, prefs) = {
        let mut p = s.prefs.lock().unwrap();
        let previous = p.clone();
        p.patch(patch);
        (previous, p.clone())
    };
    s.statistics
        .lock()
        .unwrap()
        .set_enabled(prefs.statistics_enabled);
    if previous.scale != prefs.scale
        || previous.side_buttons != prefs.side_buttons
        || previous.always_on_top != prefs.always_on_top
    {
        configure_main(app, &prefs)?;
    }
    if previous.side_buttons != prefs.side_buttons {
        // Settings (外观) and the right-click/tray menu share one preference; keep the check in sync.
        let item = s.side_item.lock().unwrap().clone();
        if let Some(item) = item {
            let _ = item.set_checked(prefs.side_buttons);
        }
    }
    if previous.mirrored != prefs.mirrored {
        if let Some(item) = s.mirror_item.lock().unwrap().as_ref() {
            let _ = item.set_checked(prefs.mirrored);
        }
    }
    s.save
        .send(SaveMessage::Update(prefs))
        .map_err(|e| e.to_string())?;
    publish(app);
    Ok(snapshot(app))
}
fn toggle(app: &tauri::AppHandle) {
    let s = app.state::<AppState>();
    let enabled = {
        let mut r = s.runtime.lock().unwrap();
        r.enabled = !r.enabled;
        r.enabled
    };
    if let Some(service) = s.input.lock().unwrap().as_ref() {
        service.set_enabled(enabled && !s.adjustments.lock().unwrap().any());
    }
    let item = s.input_item.lock().unwrap().clone();
    if let Some(item) = item {
        let _ = item.set_checked(enabled);
    }
    publish(app);
}
/// Restart the native input service (used by the error bubble and the settings 关于 sheet).
fn retry_input(app: &tauri::AppHandle) {
    let a = app.clone();
    std::thread::spawn(move || {
        let s = a.state::<AppState>();
        let mut slot = s.input.lock().unwrap();
        if let Some(mut old) = slot.take() {
            old.shutdown();
        }
        *slot = Some(InputService::start(a.clone()));
    });
}
fn open_settings(app: &tauri::AppHandle) -> Result<(), String> {
    set_adjustment(app, "settings", true)?;
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }
    let s = app.state::<AppState>();
    if s.settings_opening.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    let result = (|| {
        let (mut width, mut height) = (340.0f64, 372.0f64);
        let monitor = app.get_webview_window("main")
            .and_then(|w| w.current_monitor().ok().flatten());
        if let Some(m) = monitor.as_ref() {
            width = width.min(m.work_area().size.width as f64 / m.scale_factor() - 24.0);
            height = height.min(m.work_area().size.height as f64 / m.scale_factor() - 64.0);
        }
        let w = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("settings.html".into()))
            .title("Clawd · 设置")
            .inner_size(width, height)
            .center()
            .min_inner_size(width.min(320.0), height.min(340.0))
            .maximizable(false)
            .visible(false)
            .background_color(tauri::webview::Color(47, 43, 39, 255))
            .on_navigation(local_navigation)
            .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
            .build()
            .map_err(|e| e.to_string())?;
        if let Some(m) = monitor {
            // Move while hidden so centering uses the pet's monitor, including its DPI.
            w.set_position(m.work_area().position).map_err(|e| e.to_string())?;
            w.center().map_err(|e| e.to_string())?;
        }
        w.show().map_err(|e| e.to_string())?;
        let _ = w.set_focus();
        Ok(())
    })();
    s.settings_opening.store(false, Ordering::SeqCst);
    if result.is_err() {
        let _ = set_adjustment(app, "settings", false);
    }
    result
}
fn spawn_settings(app: &tauri::AppHandle) {
    let a = app.clone();
    std::thread::spawn(move || {
        let _ = open_settings(&a);
    });
}
pub(crate) fn local_navigation(url: &tauri::Url) -> bool {
    url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost")
}
type MenuParts = (
    Menu<tauri::Wry>,
    CheckMenuItem<tauri::Wry>,
    CheckMenuItem<tauri::Wry>,
    CheckMenuItem<tauri::Wry>,
);
/// The pet and tray share checked display controls and common actions.
/// The HTML lab entry only exists in debug (development) builds.
fn make_menu(app: &tauri::AppHandle) -> tauri::Result<MenuParts> {
    let state = app.state::<AppState>();
    let enabled = state.runtime.lock().unwrap().enabled;
    let side = state.prefs.lock().unwrap().side_buttons;
    let mirrored = state.prefs.lock().unwrap().mirrored;
    let item = |id, text| MenuItem::with_id(app, id, text, true, None::<&str>);
    let show = item("show", "显示小蟹")?;
    let input = CheckMenuItem::with_id(app, "input", "键鼠联动", true, enabled, None::<&str>)?;
    let side_buttons = CheckMenuItem::with_id(app, "side", "侧边按钮", true, side, None::<&str>)?;
    let mirror = CheckMenuItem::with_id(app, "mirror", "镜像工位", true, mirrored, None::<&str>)?;
    let settings = item("settings", "设置…")?;
    let accessories = item("accessories", "装饰…")?;
    let hide = item("hide", "隐藏")?;
    let quit = item("quit", "退出")?;
    let sep = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(
        app,
        &[
            &show,
            &input,
            &side_buttons,
            &mirror,
            &sep,
            &settings,
            &accessories,
            &sep2,
            &hide,
            &quit,
        ],
    )?;
    if cfg!(debug_assertions) {
        let lab_sep = PredefinedMenuItem::separator(app)?;
        let lab = item("lab", "打开 HTML 实验台")?;
        menu.append_items(&[&lab_sep, &lab])?;
    }
    Ok((menu, input, side_buttons, mirror))
}
fn menu_action(app: &tauri::AppHandle, id: &str) {
    match id {
        "show" => show_main(app),
        "input" => toggle(app),
        "settings" => spawn_settings(app),
        "accessories" => {
            show_main(app);
            let _ = app.emit_to("main", "clawd:accessory-open", ());
        }
        "mirror" => {
            let next = !app.state::<AppState>().prefs.lock().unwrap().mirrored;
            if apply(app, &json!({"mirrored": next})).is_err() {
                if let Some(item) = app.state::<AppState>().mirror_item.lock().unwrap().as_ref() { let _ = item.set_checked(!next); }
            }
        }
        "side" => {
            let next = !app.state::<AppState>().prefs.lock().unwrap().side_buttons;
            if apply(app, &json!({ "sideButtons": next })).is_err() {
                // Keep the native check mark truthful if the change could not be applied.
                let item = app.state::<AppState>().side_item.lock().unwrap().clone();
                if let Some(item) = item {
                    let _ = item.set_checked(!next);
                }
            }
        }
        "hide" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.hide();
            }
        }
        "retry" => retry_input(app),
        "memory" => resources::show_usage(app.clone()),
        "lab" => resources::open_lab(app),
        "quit" => app.exit(0),
        _ => {}
    }
}
#[tauri::command]
fn clawd_snapshot(window: WebviewWindow) -> Result<Value, String> {
    authorize(&window, false)?;
    Ok(snapshot(window.app_handle()))
}
#[tauri::command]
fn clawd_statistics(window: WebviewWindow) -> Result<crate::statistics::Snapshot, String> {
    authorize(&window, true)?;
    Ok(window
        .state::<AppState>()
        .statistics
        .lock()
        .unwrap()
        .snapshot())
}
#[tauri::command]
fn clawd_toggle(window: WebviewWindow) -> Result<Value, String> {
    authorize(&window, false)?;
    toggle(window.app_handle());
    Ok(snapshot(window.app_handle()))
}
#[tauri::command]
async fn clawd_settings(window: WebviewWindow) -> Result<(), String> {
    authorize(&window, false)?;
    open_settings(window.app_handle())
}
#[tauri::command]
fn clawd_hide(window: WebviewWindow) -> Result<(), String> {
    authorize(&window, true)?;
    window.hide().map_err(|e| e.to_string())
}
#[tauri::command]
fn clawd_close_settings(window: WebviewWindow) -> Result<(), String> {
    authorize(&window, false)?;
    if window.label() == "settings" {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
fn clawd_update_settings(window: WebviewWindow, patch: Value) -> Result<Value, String> {
    authorize(&window, false)?;
    apply(window.app_handle(), &patch)
}
#[tauri::command]
fn clawd_autostart(window: WebviewWindow, enabled: bool) -> Result<(), String> {
    authorize(&window, false)?;
    if window.label() != "settings" { return Err("Settings window required".into()); }
    system::set_autostart(enabled)?;
    publish(window.app_handle());
    Ok(())
}
#[tauri::command]
async fn clawd_check_updates(window: WebviewWindow) -> Result<(), String> {
    authorize_updates(&window)?;
    if !matches!(window.label(), "settings" | "updates") { return Err("Settings or update window required".into()); }
    let app = window.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || crate::update_service::check(&app, true)).await.map_err(|e| e.to_string())?
}
fn authorize_updates(window: &WebviewWindow) -> Result<(), String> {
    if !matches!(window.label(), "main" | "settings" | "updates") || !local_navigation(&window.url().map_err(|e|e.to_string())?) {return Err("Unexpected update window".into());}
    Ok(())
}
#[tauri::command]
fn clawd_update_snapshot(window: WebviewWindow) -> Result<crate::update_service::View,String> {
    authorize_updates(&window)?;Ok(crate::update_service::view(window.app_handle()))
}
#[tauri::command]
fn clawd_update_dismiss(window: WebviewWindow, snooze: bool) -> Result<(),String> {
    authorize_updates(&window)?;crate::update_service::dismiss(window.app_handle(),snooze)
}
#[tauri::command]
async fn clawd_install_update(window: WebviewWindow) -> Result<(),String> {
    authorize_updates(&window)?;
    if window.label()!="updates" {return Err("Update window required".into());}
    let app=window.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || crate::update_service::install(&app)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn clawd_uninstall(window: WebviewWindow) -> Result<(), String> {
    authorize(&window, false)?;
    if window.label() != "settings" { return Err("Settings window required".into()); }
    let app = window.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || system::uninstall(&app)).await.map_err(|e| e.to_string())?
}
#[tauri::command]
fn clawd_menu(window: WebviewWindow) -> Result<(), String> {
    authorize(&window, true)?;
    let s = window.state::<AppState>();
    let mut last = s.last_menu.lock().unwrap();
    if last.is_some_and(|t| t.elapsed() < Duration::from_millis(300)) {
        return Ok(());
    }
    *last = Some(Instant::now());
    drop(last);
    if let Some(menu) = s.menu.lock().unwrap().as_ref() {
        set_adjustment(window.app_handle(), "popup", true)?;
        let result = window.popup_menu(menu).map_err(|e| e.to_string());
        let _ = set_adjustment(window.app_handle(), "popup", false);
        result?;
    }
    Ok(())
}
#[tauri::command]
fn clawd_retry(window: WebviewWindow) -> Result<(), String> {
    authorize(&window, false)?;
    retry_input(window.app_handle());
    Ok(())
}
#[tauri::command]
fn clawd_usage(window: WebviewWindow) -> Result<(), String> {
    authorize(&window, false)?;
    resources::show_usage(window.app_handle().clone());
    Ok(())
}
#[tauri::command]
fn clawd_adjustment(window: WebviewWindow, open: bool) -> Result<(), String> {
    authorize(&window, true)?;
    set_adjustment(window.app_handle(), "accessory", open)
}
#[tauri::command]
fn clawd_ready(window: WebviewWindow) -> Result<(), String> {
    authorize(&window, true)?;
    let s = window.state::<AppState>();
    if !s.ready.swap(true, Ordering::SeqCst) {
        window.show().map_err(|e| e.to_string())?;
        let app=window.app_handle().clone();
        std::thread::spawn(move || {
            crate::update_service::startup(&app);
            let s=app.state::<AppState>();
            if crate::update_service::view(&app).phase=="idle" && !std::env::args().any(|a|a=="--updated"||a=="--update-failed") &&
               ((s.prefs.lock().unwrap().show_on_startup&&!std::env::args().any(|a|a=="--autostart"))||std::env::args().any(|a|a=="--open-settings")) {spawn_settings(&app);}
        });
    }
    Ok(())
}
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_main(app);
            spawn_settings(app);
        }))
        .invoke_handler(tauri::generate_handler![
            clawd_snapshot,
            clawd_statistics,
            clawd_toggle,
            clawd_settings,
            clawd_hide,
            clawd_close_settings,
            clawd_update_settings,
            clawd_menu,
            clawd_adjustment,
            clawd_retry,
            clawd_usage,
            clawd_ready,
            clawd_autostart,
            clawd_check_updates,
            clawd_update_snapshot,
            clawd_update_dismiss,
            clawd_install_update,
            clawd_uninstall
        ])
        .on_menu_event(|app, event| menu_action(app, event.id().as_ref()))
        .on_window_event(|window, event| {
            let app = window.app_handle();
            let Some(s) = app.try_state::<AppState>() else {
                return;
            };
            if window.label()=="updates" {
                if let WindowEvent::CloseRequested {api,..}=event {
                    if s.updater.lock().unwrap().busy {api.prevent_close();}
                }
                if matches!(event, WindowEvent::Destroyed) {crate::update_service::window_closed(app);}
            }
            if window.label() == "settings" && matches!(event, WindowEvent::Destroyed) {
                let _ = set_adjustment(app, "settings", false);
            }
            if window.label() != "main" || s.quitting.load(Ordering::Relaxed) {
                return;
            }
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    if !s.quitting.load(Ordering::Relaxed) {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
                WindowEvent::Moved(position) => {
                    let p = {
                        let mut p = s.prefs.lock().unwrap();
                        p.bounds = Some(Point {
                            x: position.x,
                            y: position.y,
                        });
                        p.clone()
                    };
                    let _ = s.save.send(SaveMessage::Update(p));
                }
                _ => {}
            }
        })
        .setup(|app| {
            let path = app.path().app_config_dir()?.join("settings.json");
            let mut prefs: Preferences = std::fs::read(&path)
                .ok()
                .and_then(|bytes| serde_json::from_slice(&bytes).ok())
                .unwrap_or_default();
            prefs.sanitize();
            let (save, save_thread) = save_worker(path.clone());
            app.manage(AppState {
                prefs: Mutex::new(prefs.clone()),
                statistics: Mutex::new(crate::statistics::Statistics::new(
                    prefs.statistics_enabled,
                )),
                adjustments: Mutex::new(Adjustments {update:true,..Adjustments::default()}),
                runtime: Mutex::new(Runtime {
                    enabled: true,
                    running: false,
                    phase: "starting".into(),
                    detail: String::new(),
                }),
                input: Mutex::new(None),
                save,
                save_thread: Mutex::new(Some(save_thread)),
                quitting: AtomicBool::new(false),
                ready: AtomicBool::new(false),
                settings_opening: AtomicBool::new(false),
                last_menu: Mutex::new(None),
                menu: Mutex::new(None),
                input_item: Mutex::new(None),
                side_item: Mutex::new(None),
                mirror_item: Mutex::new(None),
                updater: Mutex::new(crate::update_service::UpdateRuntime::load(path.with_file_name("updates-state.json"))),
            });
            let (width, height) = prefs.dimensions();
            let main = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Bongo Clawd")
                .inner_size(width.round(), height.round())
                .center()
                .decorations(false)
                .transparent(true)
                .background_color(tauri::webview::Color(0, 0, 0, 0))
                .shadow(false)
                .resizable(false)
                .maximizable(false)
                .fullscreen(false)
                .skip_taskbar(true)
                .always_on_top(prefs.always_on_top)
                .focused(false)
                .visible(false)
                .disable_drag_drop_handler()
                .zoom_hotkeys_enabled(false)
                .on_navigation(local_navigation)
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                .build()?;
            resources::position_at_bottom_right(&main);
            let (menu, input, side, mirror) = make_menu(app.handle())?;
            let state = app.state::<AppState>();
            *state.menu.lock().unwrap() = Some(menu.clone());
            *state.input_item.lock().unwrap() = Some(input);
            *state.side_item.lock().unwrap() = Some(side);
            *state.mirror_item.lock().unwrap() = Some(mirror);
            let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))?;
            let tray = TrayIconBuilder::with_id("clawd-lite")
                .icon(icon)
                .tooltip("Bongo Clawd")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Right,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let tray = tray.clone();
                        let app = tray.app_handle().clone();
                        std::thread::spawn(move || {
                            let _ = set_adjustment(&app, "popup", true);
                            let _ = tray.with_inner_tray_icon(|icon| icon.show_menu());
                            let _ = set_adjustment(&app, "popup", false);
                        });
                        return;
                    }
                    if let TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            tray.with_inner_tray_icon(|icon| icon.set_show_menu_on_right_click(false))?;
            app.manage(tray);
            *state.input.lock().unwrap() = Some(InputService::start(app.handle().clone()));
            Ok(())
        })
        .build(tauri::generate_context!());
    let app = match app {
        Ok(app) => app,
        Err(error) => {
            resources::show_startup_error(&error.to_string());
            return;
        }
    };
    app.run(|app, event| {
        if matches!(event, RunEvent::Exit) {
            let s = app.state::<AppState>();
            s.quitting.store(true, Ordering::SeqCst);
            if let Some(mut input) = s.input.lock().unwrap().take() {
                input.shutdown();
            }
            let prefs = s.prefs.lock().unwrap().clone();
            let _ = s.save.send(SaveMessage::Stop(prefs));
            if let Some(writer) = s.save_thread.lock().unwrap().take() {
                let _ = writer.join();
            };
        }
    });
}
