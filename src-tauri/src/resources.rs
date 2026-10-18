use serde::Serialize;
use tauri::Manager;
#[derive(Clone, Debug, Serialize)]
pub struct Usage {
    pub process_count: usize,
    pub measured_count: usize,
    pub private_bytes: u64,
    pub working_set: u64,
}
pub fn show_startup_error(error: &str) {
    native::message(0, "Clawd Lite · 无法启动", &format!("小蟹暂时没能启动。请确认系统是 Windows 10 / 11 x64，并已安装 Microsoft Edge WebView2 Runtime。\n\n详细信息：{error}"));
}
pub fn ensure_visible(window: &tauri::WebviewWindow) {
    let Ok(position) = window.outer_position() else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };
    let Ok(monitors) = window.available_monitors() else {
        return;
    };
    let visible = monitors.iter().any(|m| {
        let p = m.position();
        let s = m.size();
        position.x as i64 + (size.width as i64) > p.x as i64 + 24
            && position.y as i64 + (size.height as i64) > p.y as i64 + 24
            && (position.x as i64) < p.x as i64 + s.width as i64 - 24
            && (position.y as i64) < p.y as i64 + s.height as i64 - 24
    });
    if !visible {
        let _ = window.center();
    }
}
pub fn show_usage(app: tauri::AppHandle) {
    let owner = app
        .get_webview_window("main")
        .and_then(|w| w.hwnd().ok())
        .map(|h| h.0 as isize)
        .unwrap_or(0);
    std::thread::spawn(move || {
        let message=match native::usage(){Ok(u)=>format!("专用内存（提交量）\nRust 本体与 WebView2（{} 个进程）\n{}：{:.1} MiB\n\n工作集{}：{:.1} MiB\n成功读取：{} / {} 个进程\n\n输入监听已在 Rust 本体内，没有 PowerShell 输入进程。\n工作集合计含共享部分，可能重复计算；提交量不等于独占物理内存。\n这是即时快照；CPU 请在任务管理器中统计整个相关进程组。",u.process_count,if u.measured_count==u.process_count{"合计"}else{"已读取部分合计（非完整占用）"},u.private_bytes as f64/1048576.0,if u.measured_count==u.process_count{"合计"}else{"已读取部分合计"},u.working_set as f64/1048576.0,u.measured_count,u.process_count),Err(e)=>e};
        native::message(owner, "Clawd Lite · 运行占用", &message);
    });
}
pub fn open_lab(app: &tauri::AppHandle) {
    if let Ok(dir) = app.path().app_cache_dir() {
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("Clawd-lab.html");
        if std::fs::write(&path, include_bytes!("../assets/Clawd-lab.html")).is_ok() {
            native::open_path(&path);
        }
    }
}
#[cfg(windows)]
mod native {
    use super::*;
    use std::{
        collections::HashSet,
        mem::{size_of, zeroed},
        ptr::null_mut,
    };
    use windows_sys::Win32::{
        Foundation::*,
        System::{Diagnostics::ToolHelp::*, ProcessStatus::*, Threading::*},
        UI::{Shell::ShellExecuteW, WindowsAndMessaging::*},
    };
    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(Some(0)).collect()
    }
    pub fn message(owner: isize, title: &str, text: &str) {
        unsafe {
            MessageBoxW(
                owner as HWND,
                wide(text).as_ptr(),
                wide(title).as_ptr(),
                MB_OK | MB_ICONINFORMATION,
            );
        }
    }
    pub fn open_path(path: &std::path::Path) {
        use std::os::windows::ffi::OsStrExt;
        let path: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        unsafe {
            ShellExecuteW(
                null_mut(),
                wide("open").as_ptr(),
                path.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            );
        }
    }
    pub fn usage() -> Result<Usage, String> {
        unsafe {
            let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if snap == INVALID_HANDLE_VALUE {
                return Err("无法读取进程快照".into());
            }
            let mut entry: PROCESSENTRY32W = zeroed();
            entry.dwSize = size_of::<PROCESSENTRY32W>() as u32;
            let mut entries = Vec::new();
            let mut valid = Process32FirstW(snap, &mut entry) != 0;
            while valid {
                let len = entry
                    .szExeFile
                    .iter()
                    .position(|c| *c == 0)
                    .unwrap_or(entry.szExeFile.len());
                entries.push((
                    entry.th32ProcessID,
                    entry.th32ParentProcessID,
                    String::from_utf16_lossy(&entry.szExeFile[..len]).to_lowercase(),
                ));
                valid = Process32NextW(snap, &mut entry) != 0;
            }
            CloseHandle(snap);
            let own = GetCurrentProcessId();
            let mut descendants = HashSet::from([own]);
            loop {
                let n = descendants.len();
                for (pid, parent, _) in &entries {
                    if descendants.contains(parent) {
                        descendants.insert(*pid);
                    }
                }
                if descendants.len() == n {
                    break;
                }
            }
            let pids: Vec<u32> = entries
                .iter()
                .filter(|(pid, _, name)| {
                    *pid == own || (descendants.contains(pid) && name == "msedgewebview2.exe")
                })
                .map(|e| e.0)
                .collect();
            let mut result = Usage {
                process_count: pids.len(),
                measured_count: 0,
                private_bytes: 0,
                working_set: 0,
            };
            for pid in pids {
                let process = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
                if process.is_null() {
                    continue;
                }
                let mut memory: PROCESS_MEMORY_COUNTERS_EX = zeroed();
                memory.cb = size_of::<PROCESS_MEMORY_COUNTERS_EX>() as u32;
                if K32GetProcessMemoryInfo(
                    process,
                    &mut memory as *mut _ as *mut PROCESS_MEMORY_COUNTERS,
                    size_of::<PROCESS_MEMORY_COUNTERS_EX>() as u32,
                ) != 0
                {
                    result.measured_count += 1;
                    result.private_bytes += memory.PrivateUsage as u64;
                    result.working_set += memory.WorkingSetSize as u64;
                }
                CloseHandle(process);
            }
            if result.measured_count == 0 {
                Err("未能读取内存，请用任务管理器检查".into())
            } else {
                Ok(result)
            }
        }
    }
}
#[cfg(not(windows))]
mod native {
    use super::*;
    pub fn usage() -> Result<Usage, String> {
        Err("仅支持 Windows".into())
    }
    pub fn message(_: isize, _: &str, _: &str) {}
    pub fn open_path(_: &std::path::Path) {}
}
