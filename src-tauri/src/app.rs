use crate::{
    input::InputService,
    preferences::{Point, Preferences},
    resources,
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
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
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
pub struct AppState {
    pub prefs: Mutex<Preferences>,
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
    let mut value = serde_json::to_value(p).unwrap();
    let map = value.as_object_mut().unwrap();
    map.extend(json!({"enabled":r.enabled,"running":r.running,"phase":r.phase,"detail":r.detail,"platform":"win32","edition":"Tauri · 对比候选版","version":env!("CARGO_PKG_VERSION")}).as_object().unwrap().clone());
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
    let (width, height) = p.dimensions();
    w.set_size(tauri::LogicalSize::new(width.round(), height.round()))
        .map_err(|e| e.to_string())?;
    w.set_always_on_top(p.always_on_top)
        .map_err(|e| e.to_string())?;
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
    if previous.scale != prefs.scale
        || previous.show_top_bar != prefs.show_top_bar
        || previous.show_bottom_bar != prefs.show_bottom_bar
        || previous.always_on_top != prefs.always_on_top
    {
        configure_main(app, &prefs)?;
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
        service.set_enabled(enabled);
    }
    let item = s.input_item.lock().unwrap().clone();
    if let Some(item) = item {
        let _ = item.set_checked(enabled);
    }
    publish(app);
}
fn open_settings(app: &tauri::AppHandle) -> Result<(), String> {
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
        let (mut width, mut height) = (460.0f64, 680.0f64);
        if let Some(w) = app.get_webview_window("main") {
            if let Ok(Some(m)) = w.current_monitor() {
                width = width.min(m.size().width as f64 / m.scale_factor() - 24.0);
                height = height.min(m.size().height as f64 / m.scale_factor() - 64.0);
            }
        }
        let w = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("settings.html".into()))
            .title("Clawd Lite · 小工位设置")
            .inner_size(width, height)
            .min_inner_size(width.min(400.0), height.min(480.0))
            .visible(false)
            .background_color(tauri::webview::Color(250, 247, 240, 255))
            .on_navigation(local_navigation)
            .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
            .build()
            .map_err(|e| e.to_string())?;
        w.show().map_err(|e| e.to_string())?;
        let _ = w.set_focus();
        Ok(())
    })();
    s.settings_opening.store(false, Ordering::SeqCst);
    result
}
fn spawn_settings(app: &tauri::AppHandle) {
    let a = app.clone();
    std::thread::spawn(move || {
        let _ = open_settings(&a);
    });
}
fn local_navigation(url: &tauri::Url) -> bool {
    url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost")
}
fn make_menu(
    app: &tauri::AppHandle,
) -> tauri::Result<(Menu<tauri::Wry>, CheckMenuItem<tauri::Wry>)> {
    let enabled = app.state::<AppState>().runtime.lock().unwrap().enabled;
    let item = |id, text| MenuItem::with_id(app, id, text, true, None::<&str>);
    let show = item("show", "显示小蟹")?;
    let input = CheckMenuItem::with_id(app, "input", "全局键鼠联动", true, enabled, None::<&str>)?;
    let settings = item("settings", "设置与缩放…")?;
    let bars = item("bars", "恢复上下栏")?;
    let retry = item("retry", "重试输入服务")?;
    let memory = item("memory", "查看运行占用")?;
    let lab = item("lab", "打开 HTML 实验台")?;
    let hide = item("hide", "收进托盘")?;
    let quit = item("quit", "退出小蟹 Lite")?;
    let sep = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(
        app,
        &[
            &show, &input, &settings, &bars, &retry, &sep, &memory, &lab, &hide, &sep2, &quit,
        ],
    )?;
    Ok((menu, input))
}
fn menu_action(app: &tauri::AppHandle, id: &str) {
    match id {
        "show" => show_main(app),
        "input" => toggle(app),
        "settings" => spawn_settings(app),
        "bars" => {
            let _ = apply(app, &json!({"showTopBar":true,"showBottomBar":true}));
        }
        "hide" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.hide();
            }
        }
        "retry" => {
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
        window.popup_menu(menu).map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
fn clawd_ready(window: WebviewWindow) -> Result<(), String> {
    authorize(&window, true)?;
    let s = window.state::<AppState>();
    if !s.ready.swap(true, Ordering::SeqCst) {
        window.show().map_err(|e| e.to_string())?;
        if s.prefs.lock().unwrap().show_on_startup {
            spawn_settings(window.app_handle());
        }
    }
    Ok(())
}
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_main(app)
        }))
        .invoke_handler(tauri::generate_handler![
            clawd_snapshot,
            clawd_toggle,
            clawd_settings,
            clawd_hide,
            clawd_close_settings,
            clawd_update_settings,
            clawd_menu,
            clawd_ready
        ])
        .on_menu_event(|app, event| menu_action(app, event.id().as_ref()))
        .on_window_event(|window, event| {
            let app = window.app_handle();
            let Some(s) = app.try_state::<AppState>() else {
                return;
            };
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
            });
            let (width, height) = prefs.dimensions();
            let main = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Bongo Clawd Lite · 对比候选版")
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
            if let Some(b) = prefs.bounds {
                let _ = main.set_position(tauri::PhysicalPosition::new(b.x, b.y));
                resources::ensure_visible(&main);
            }
            let (menu, input) = make_menu(app.handle())?;
            let state = app.state::<AppState>();
            *state.menu.lock().unwrap() = Some(menu.clone());
            *state.input_item.lock().unwrap() = Some(input);
            let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))?;
            let tray = TrayIconBuilder::with_id("clawd-lite")
                .icon(icon)
                .tooltip("Bongo Clawd Lite · 轻量对比候选版")
                .menu(&menu)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
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
