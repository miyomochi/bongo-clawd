use crate::{app::{self, AppState}, system, updates::{self, Release}};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{path::PathBuf, time::Duration};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(default, rename_all="camelCase")]
pub struct Store { checked_day: String, snoozed_day: String, pending_version: Option<String> }
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all="camelCase")]
pub struct View {
    pub phase: String, pub release: Option<Release>, pub progress: Option<f64>,
    pub error: String, pub message: String, pub manual: bool, pub installed: bool,
}
impl Default for View { fn default() -> Self { Self { phase:"idle".into(), release:None, progress:None, error:String::new(), message:String::new(), manual:false, installed:false } } }
pub struct UpdateRuntime { pub view: View, pub busy: bool, store: Store, path: PathBuf }
impl UpdateRuntime {
    pub fn load(path: PathBuf) -> Self {
        let store=std::fs::read(&path).ok().and_then(|b|serde_json::from_slice(&b).ok()).unwrap_or_default();
        Self {view:View::default(),busy:false,store,path}
    }
    fn save(&self) -> Result<(),String> {
        if let Some(parent)=self.path.parent(){std::fs::create_dir_all(parent).map_err(|e|e.to_string())?;}
        let temp=self.path.with_extension("tmp");
        std::fs::write(&temp,serde_json::to_vec(&self.store).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
        std::fs::rename(&temp,&self.path).map_err(|e|e.to_string())
    }
}
fn today()->String {chrono::Local::now().format("%Y-%m-%d").to_string()}
pub fn view(app:&tauri::AppHandle)->View {app.state::<AppState>().updater.lock().unwrap().view.clone()}
fn publish(app:&tauri::AppHandle) {
    let value=view(app);let _=app.emit("clawd:update",&value);app::publish(app);
}
fn hold(app:&tauri::AppHandle,active:bool) {let _=app::set_adjustment(app,"update",active);}
fn window(app:&tauri::AppHandle) {
    let app=app.clone();let dispatch=app.clone();
    let _=dispatch.run_on_main_thread(move || {
        if let Some(w)=app.get_webview_window("updates"){let _=w.show();let _=w.set_focus();return;}
        let _=WebviewWindowBuilder::new(&app,"updates",WebviewUrl::App("updates.html".into()))
            .title("Bongo Clawd · 更新").inner_size(440.0,430.0).center().resizable(false)
            .decorations(false).always_on_top(true).on_navigation(app::local_navigation)
            .on_new_window(|_,_|tauri::webview::NewWindowResponse::Deny).build();
    });
}
fn fail(app:&tauri::AppHandle,error:String) {
    if app.state::<AppState>().quitting.load(std::sync::atomic::Ordering::SeqCst){return;}
    {let s=app.state::<AppState>();let mut u=s.updater.lock().unwrap();u.busy=false;u.view.phase="error".into();u.view.error=error;u.view.progress=None;}
    hold(app,true);publish(app);window(app);
}
pub fn dismiss(app:&tauri::AppHandle,snooze:bool)->Result<(),String> {
    {let s=app.state::<AppState>();let mut u=s.updater.lock().unwrap();if u.busy{return Err("请等待当前更新步骤完成。".into());}
     if snooze {u.store.snoozed_day=today();u.save()?;}u.view=View::default();}
    hold(app,false);publish(app);
    if let Some(w)=app.get_webview_window("updates"){let _=w.close();}Ok(())
}
pub fn window_closed(app:&tauri::AppHandle) {if view(app).phase!="idle" {let _=dismiss(app,false);}}
pub fn check(app:&tauri::AppHandle,manual:bool)->Result<(),String> {
    {
        let s=app.state::<AppState>();let mut u=s.updater.lock().unwrap();
        if u.busy {return Ok(());}
        let old=u.store.checked_day.clone();u.store.checked_day=today();
        if let Err(e)=u.save(){u.store.checked_day=old;return Err(format!("无法记录今天的更新检查：{e}"));}
        u.busy=true;u.view=View {phase:"checking".into(),manual,installed:system::installed(),..View::default()};
    }
    hold(app,true);publish(app);
    if let Some(w)=app.get_webview_window("main"){let _=w.show();}
    if manual {window(app);}
    let started=std::time::Instant::now();
    let result=system::fetch_update_manifest().and_then(|b|updates::parse_release(&b,env!("CARGO_PKG_VERSION")));
    if started.elapsed()<Duration::from_millis(600){std::thread::sleep(Duration::from_millis(600).saturating_sub(started.elapsed()));}
    match result {
        Ok((release,newer))=>{
            {let s=app.state::<AppState>();let mut u=s.updater.lock().unwrap();u.busy=false;u.view.phase=if newer{"available"}else{"current"}.into();u.view.release=Some(release);}
            publish(app);
            if newer {system::update_chime();window(app);}else if manual {window(app);}else {
                std::thread::sleep(Duration::from_millis(1100));
                if view(app).phase=="current"&&!view(app).manual {let _=dismiss(app,false);}
            }
            Ok(())
        }
        Err(e)=>{fail(app,e.clone());Err(e)}
    }
}
pub fn startup(app:&tauri::AppHandle) {
    let pending={let s=app.state::<AppState>();let mut u=s.updater.lock().unwrap();let p=u.store.pending_version.take();if p.is_some(){let _=u.save();}p};
    if let Some(expected)=pending {
        let success=semver::Version::parse(env!("CARGO_PKG_VERSION")).ok().zip(semver::Version::parse(&expected).ok()).is_some_and(|(a,b)|a>=b);
        if success {
            {let s=app.state::<AppState>();let mut u=s.updater.lock().unwrap();u.view=View {phase:"success".into(),message:format!("已升级到 {expected}"),..View::default()};}
            hold(app,true);publish(app);system::update_chime();std::thread::sleep(Duration::from_millis(4000));
            if view(app).phase=="success"{let _=dismiss(app,false);}return;
        }
        fail(app,format!("上次更新没有完成，当前仍为 {}。可以稍后重新检查。",env!("CARGO_PKG_VERSION")));return;
    }
    let due={let s=app.state::<AppState>();let enabled=s.prefs.lock().unwrap().auto_check_updates;let u=s.updater.lock().unwrap();updates::daily_check_due(enabled,&u.store.checked_day,&u.store.snoozed_day,&today())};
    if due {if let Err(e)=check(app,false){if view(app).phase!="error"{fail(app,e);}}} else {hold(app,false);}
}
pub fn install(app:&tauri::AppHandle)->Result<(),String> {
    let release={let s=app.state::<AppState>();let mut u=s.updater.lock().unwrap();
        if u.busy||u.view.phase!="available" {return Err("当前没有可安装的新版本。".into());}
        let r=u.view.release.clone().ok_or("缺少更新信息。")?;
        if r.sha256.is_empty(){return Err("这个版本尚未提供下载校验值，请稍后重试。".into());}
        if !r.download_url.ends_with(&format!("Bongo-Clawd-{}-Windows-x64-Setup.zip",r.version)){return Err("更新包不是预期的安装版。".into());}
        u.busy=true;u.view.phase="downloading".into();u.view.progress=None;r};
    publish(app);
    let result=(||->Result<(),String>{
        let bytes=system::download_update(&release.download_url,|done,total|{
            {let s=app.state::<AppState>();let mut u=s.updater.lock().unwrap();u.view.progress=total.map(|n|done as f64/n as f64);}
            publish(app);
            !app.state::<AppState>().quitting.load(std::sync::atomic::Ordering::SeqCst)
        })?;
        if app.state::<AppState>().quitting.load(std::sync::atomic::Ordering::SeqCst){return Err("更新已取消。".into());}
        {let s=app.state::<AppState>();let mut u=s.updater.lock().unwrap();u.view.phase="verifying".into();u.view.progress=None;}publish(app);
        if !format!("{:x}",Sha256::digest(&bytes)).eq_ignore_ascii_case(&release.sha256){return Err("更新包校验失败，已停止安装。请重新检查更新。".into());}
        let nonce=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e|e.to_string())?.as_millis();
        let dir=app.path().app_cache_dir().map_err(|e|e.to_string())?.join(format!("update-{}-{nonce}",release.version));
        std::fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
        let zip=dir.join("package.zip");std::fs::write(&zip,&bytes).map_err(|e|e.to_string())?;drop(bytes);
        let entry=format!("Bongo-Clawd-{}-Windows-x64-Setup.exe",release.version);let installer=dir.join(&entry);
        system::extract_installer(&zip,&installer,&entry)?;
        if app.state::<AppState>().quitting.load(std::sync::atomic::Ordering::SeqCst){return Err("更新已取消。".into());}
        {let s=app.state::<AppState>();let mut u=s.updater.lock().unwrap();u.store.pending_version=Some(release.version.clone());u.save()?;u.view.phase="installing".into();}publish(app);
        if let Err(e)=system::launch_update(&installer){let s=app.state::<AppState>();let mut u=s.updater.lock().unwrap();u.store.pending_version=None;let _=u.save();return Err(e);}
        app.exit(0);Ok(())
    })();
    if let Err(ref error)=result {fail(app,error.clone());}result
}
