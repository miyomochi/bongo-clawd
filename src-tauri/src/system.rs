use tauri::Manager;

fn owner(app: &tauri::AppHandle) -> isize {
    app.get_webview_window("settings")
        .or_else(|| app.get_webview_window("main"))
        .and_then(|w| w.hwnd().ok())
        .map(|h| h.0 as isize).unwrap_or(0)
}

pub fn autostart_enabled() -> bool { native::autostart_enabled() }
pub fn set_autostart(enabled: bool) -> Result<(), String> { native::set_autostart(enabled) }
pub fn open_project_link(target: &str) -> Result<(), String> {
    let url = match target {
        "author" => "https://github.com/miyomochi",
        "repository" => "https://github.com/miyomochi/bongo-clawd",
        _ => return Err("Unknown project link".into()),
    };
    native::open_url(url)
}
pub fn installed() -> bool { native::uninstaller().is_some() }

pub fn fetch_update_manifest() -> Result<Vec<u8>, String> { native::fetch_manifest() }
pub fn download_update(url: &str, progress: impl Fn(u64, Option<u64>) -> bool) -> Result<Vec<u8>, String> { native::download_update(url, progress) }
pub fn update_chime() { native::update_chime(); }
pub fn extract_installer(zip: &std::path::Path, installer: &std::path::Path, entry: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    let status = std::process::Command::new(powershell())
        .args(["-NoProfile", "-NonInteractive", "-Command", include_str!("update-extract.ps1")])
        .env("CLAWD_UPDATE_ZIP", zip).env("CLAWD_UPDATE_INSTALLER", installer).env("CLAWD_UPDATE_ENTRY", entry)
        .creation_flags(0x08000000).status().map_err(|e| format!("无法准备安装程序：{e}"))?;
    if status.success() { Ok(()) } else { Err("无法从更新包中取出安装程序。".into()) }
}
fn powershell() -> std::path::PathBuf {
    std::env::var_os("SystemRoot").map(std::path::PathBuf::from).unwrap_or_else(|| r"C:\Windows".into())
        .join("System32/WindowsPowerShell/v1.0/powershell.exe")
}
pub fn launch_update(installer: &std::path::Path) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    let old = std::env::current_exe().map_err(|e| e.to_string())?;
    let target = old.parent().map(|p| p.to_path_buf());
    std::process::Command::new(powershell())
        .args(["-NoProfile", "-NonInteractive", "-Command", include_str!("update-launch.ps1")])
        .env("CLAWD_UPDATE_PID", std::process::id().to_string()).env("CLAWD_UPDATE_INSTALLER", installer)
        .env("CLAWD_UPDATE_OLD_EXE", &old).env("CLAWD_UPDATE_TARGET_DIR", target.unwrap_or_default())
        .creation_flags(0x08000000).spawn().map_err(|e| format!("无法启动安装向导：{e}"))?;
    Ok(())
}

pub fn uninstall(app: &tauri::AppHandle) -> Result<(), String> {
    let Some(path) = native::uninstaller() else {
        native::message(owner(app), "便携版无需卸载", "当前运行的是便携版。\n\n请先关闭开机自启动，再从托盘退出小蟹，最后删除程序文件夹即可。个人设置保存在用户目录中。");
        return Ok(());
    };
    if native::confirm(owner(app), "卸载 Bongo Clawd", "将打开卸载向导，并退出当前小蟹。\n\n卸载后保留个人设置。是否继续？") {
        std::process::Command::new(path).spawn()
            .map_err(|e| format!("无法启动卸载程序：{e}"))?;
        app.exit(0);
    }
    Ok(())
}

#[cfg(windows)]
mod native {
    use std::{ffi::c_void, path::PathBuf, ptr::{null, null_mut}};
    use windows_sys::Win32::{Foundation::*, Networking::WinHttp::*, System::{Diagnostics::Debug::MessageBeep, Registry::*}, UI::{Shell::ShellExecuteW, WindowsAndMessaging::*}};
    const RUN: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const UNINSTALL: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\BongoClawd";
    fn wide(s: &str) -> Vec<u16> { s.encode_utf16().chain(Some(0)).collect() }
    fn read_string(key: &str, name: &str) -> Option<String> {
        let mut bytes = 0;
        unsafe {
            if RegGetValueW(HKEY_CURRENT_USER, wide(key).as_ptr(), wide(name).as_ptr(), RRF_RT_REG_SZ, null_mut(), null_mut(), &mut bytes) != ERROR_SUCCESS || bytes > 65536 { return None; }
            let mut value = vec![0u16; (bytes as usize + 1) / 2];
            if RegGetValueW(HKEY_CURRENT_USER, wide(key).as_ptr(), wide(name).as_ptr(), RRF_RT_REG_SZ, null_mut(), value.as_mut_ptr().cast(), &mut bytes) != ERROR_SUCCESS { return None; }
            Some(String::from_utf16_lossy(&value[..value.iter().position(|c| *c == 0).unwrap_or(value.len())]))
        }
    }
    fn startup_command() -> Result<String, String> {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        Ok(format!("\"{}\" --autostart", exe.display()))
    }
    pub fn autostart_enabled() -> bool {
        startup_command().ok().zip(read_string(RUN, "BongoClawd"))
            .is_some_and(|(expected, value)| expected.eq_ignore_ascii_case(&value))
    }
    pub fn set_autostart(enabled: bool) -> Result<(), String> {
        let code = unsafe {
            if enabled {
                let mut key = null_mut();
                let status = RegCreateKeyW(HKEY_CURRENT_USER, wide(RUN).as_ptr(), &mut key);
                if status != ERROR_SUCCESS { return Err(format!("无法设置开机自启动（错误 {status}）。")); }
                let value = wide(&startup_command()?);
                let result = RegSetValueExW(key, wide("BongoClawd").as_ptr(), 0, REG_SZ, value.as_ptr().cast(), (value.len() * 2) as u32);
                RegCloseKey(key);
                result
            } else {
                RegDeleteKeyValueW(HKEY_CURRENT_USER, wide(RUN).as_ptr(), wide("BongoClawd").as_ptr())
            }
        };
        if code == ERROR_SUCCESS || (!enabled && code == ERROR_FILE_NOT_FOUND) { Ok(()) }
        else { Err(format!("无法修改开机自启动（错误 {code}）。")) }
    }
    pub fn uninstaller() -> Option<PathBuf> {
        let exe = std::env::current_exe().ok()?;
        let dir = exe.parent()?.canonicalize().ok()?;
        let installed = PathBuf::from(read_string(UNINSTALL, "InstallLocation")?).canonicalize().ok()?;
        if !dir.to_string_lossy().eq_ignore_ascii_case(&installed.to_string_lossy()) { return None; }
        let path = dir.join("Uninstall.exe");
        path.is_file().then_some(path)
    }
    pub fn message(owner: isize, title: &str, text: &str) {
        unsafe { MessageBoxW(owner as HWND, wide(text).as_ptr(), wide(title).as_ptr(), MB_OK | MB_ICONINFORMATION); }
    }
    pub fn confirm(owner: isize, title: &str, text: &str) -> bool {
        unsafe { MessageBoxW(owner as HWND, wide(text).as_ptr(), wide(title).as_ptr(), MB_YESNO | MB_ICONQUESTION | MB_DEFBUTTON2) == IDYES }
    }
    pub fn open_url(url: &str) -> Result<(), String> {
        let result = unsafe { ShellExecuteW(null_mut(), wide("open").as_ptr(), wide(url).as_ptr(), null(), null(), SW_SHOWNORMAL) };
        if result as isize > 32 { Ok(()) } else { Err("无法打开下载地址，请检查默认浏览器。".into()) }
    }
    struct Handle(*mut c_void);
    impl Drop for Handle { fn drop(&mut self) { unsafe { WinHttpCloseHandle(self.0); } } }
    fn handle(value: *mut c_void) -> Result<Handle, String> {
        if value.is_null() { Err("无法连接更新服务器。".into()) } else { Ok(Handle(value)) }
    }
    pub fn fetch_manifest() -> Result<Vec<u8>, String> {
        unsafe {
            let session = handle(WinHttpOpen(wide("BongoClawd/0.2.1").as_ptr(), WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, null(), null(), 0))?;
            WinHttpSetTimeouts(session.0, 8000, 8000, 10000, 10000);
            let connection = handle(WinHttpConnect(session.0, wide("raw.githubusercontent.com").as_ptr(), 443, 0))?;
            let request = handle(WinHttpOpenRequest(connection.0, wide("GET").as_ptr(), wide("/miyomochi/bongo-clawd/main/updates/latest.json").as_ptr(), null(), null(), null(), WINHTTP_FLAG_SECURE))?;
            let headers = wide("Cache-Control: no-cache\r\n");
            if WinHttpSendRequest(request.0, headers.as_ptr(), u32::MAX, null(), 0, 0, 0) == 0 || WinHttpReceiveResponse(request.0, null_mut()) == 0 { return Err("连接更新服务器失败。".into()); }
            let mut status = 0u32;
            let mut size = 4;
            if WinHttpQueryHeaders(request.0, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, null(), (&mut status as *mut u32).cast(), &mut size, null_mut()) == 0 || status != 200 { return Err(format!("更新服务暂时不可用（HTTP {status}）。")); }
            let mut result = Vec::new();
            loop {
                let mut block = [0u8; 4096];
                let mut read = 0;
                if WinHttpReadData(request.0, block.as_mut_ptr().cast(), block.len() as u32, &mut read) == 0 { return Err("读取更新信息失败。".into()); }
                if read == 0 { break; }
                if result.len() + read as usize > 32768 { return Err("更新信息大小异常。".into()); }
                result.extend_from_slice(&block[..read as usize]);
            }
            Ok(result)
        }
    }
    pub fn update_chime() { unsafe { MessageBeep(MB_ICONINFORMATION); } }
    pub fn download_update(url: &str, progress: impl Fn(u64, Option<u64>) -> bool) -> Result<Vec<u8>, String> {
        let parsed = tauri::Url::parse(url).map_err(|_| "更新下载地址无效。")?;
        if parsed.scheme() != "https" { return Err("更新下载必须使用 HTTPS。".into()); }
        let host = parsed.host_str().ok_or("更新下载地址无效。")?;
        let began = std::time::Instant::now();
        unsafe {
            let session = handle(WinHttpOpen(wide("BongoClawd updater").as_ptr(), WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, null(), null(), 0))?;
            WinHttpSetTimeouts(session.0, 5000, 5000, 10000, 10000);
            let connection = handle(WinHttpConnect(session.0, wide(host).as_ptr(), 443, 0))?;
            let request = handle(WinHttpOpenRequest(connection.0, wide("GET").as_ptr(), wide(parsed.path()).as_ptr(), null(), null(), null(), WINHTTP_FLAG_SECURE))?;
            if WinHttpSendRequest(request.0, null(), 0, null(), 0, 0, 0) == 0 || WinHttpReceiveResponse(request.0, null_mut()) == 0 { return Err("下载更新失败，请检查网络。".into()); }
            let mut status = 0u32; let mut size = 4;
            if WinHttpQueryHeaders(request.0, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, null(), (&mut status as *mut u32).cast(), &mut size, null_mut()) == 0 || status != 200 { return Err(format!("下载服务返回 HTTP {status}。")); }
            let mut length=0u32;size=4;
            let total=if WinHttpQueryHeaders(request.0, WINHTTP_QUERY_CONTENT_LENGTH | WINHTTP_QUERY_FLAG_NUMBER, null(), (&mut length as *mut u32).cast(), &mut size, null_mut())!=0 && length>0 { Some(length as u64) } else {None};
            if total.is_some_and(|n| n>32*1024*1024) {return Err("更新包超过大小限制。".into());}
            let mut result=Vec::new();let mut last=std::time::Instant::now();
            loop {
                if began.elapsed()>std::time::Duration::from_secs(90) {return Err("下载超时，请稍后重试。".into());}
                let mut block=[0u8;32768];let mut read=0;
                if WinHttpReadData(request.0, block.as_mut_ptr().cast(), block.len() as u32, &mut read)==0 {return Err("更新下载中断。".into());}
                if read==0 {break;}
                if result.len()+read as usize>32*1024*1024 {return Err("更新包超过大小限制。".into());}
                result.extend_from_slice(&block[..read as usize]);
                if last.elapsed()>std::time::Duration::from_millis(150) {if !progress(result.len() as u64,total){return Err("更新已取消。".into());}last=std::time::Instant::now();}
            }
            if total.is_some_and(|n| n!=result.len() as u64) {return Err("更新包下载不完整。".into());}
            if !progress(result.len() as u64,total){return Err("更新已取消。".into());}Ok(result)
        }
    }

}
