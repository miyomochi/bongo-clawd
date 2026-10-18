use std::sync::{
    atomic::{AtomicBool, AtomicIsize, Ordering},
    Arc,
};
use std::thread::JoinHandle;

pub struct InputService {
    hwnd: Arc<AtomicIsize>,
    desired: Arc<AtomicBool>,
    stopping: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}
impl InputService {
    pub fn start(app: tauri::AppHandle) -> Self {
        let hwnd = Arc::new(AtomicIsize::new(0));
        let desired = Arc::new(AtomicBool::new(
            app.state::<crate::app::AppState>()
                .runtime
                .lock()
                .unwrap()
                .enabled,
        ));
        let stopping = Arc::new(AtomicBool::new(false));
        let (h, d, s) = (hwnd.clone(), desired.clone(), stopping.clone());
        let thread = std::thread::spawn(move || {
            if let Err(error) = native::run(app.clone(), h, d, s) {
                crate::app::report(&app, false, "error", &error);
            }
        });
        Self {
            hwnd,
            desired,
            stopping,
            thread: Some(thread),
        }
    }
    pub fn set_enabled(&self, enabled: bool) {
        self.desired.store(enabled, Ordering::SeqCst);
        native::notify(self.hwnd.load(Ordering::SeqCst), false);
    }
    pub fn shutdown(&mut self) {
        self.stopping.store(true, Ordering::SeqCst);
        native::notify(self.hwnd.load(Ordering::SeqCst), true);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}
use tauri::Manager;
#[cfg(windows)]
mod native {
    use super::*;
    use crate::protocol::{key_event, movement, push_bounded, InputEvent};
    use std::{
        mem::{size_of, zeroed},
        ptr::{null, null_mut},
    };
    use tauri::Emitter;
    use windows_sys::Win32::{
        Foundation::*,
        System::{LibraryLoader::GetModuleHandleW, RemoteDesktop::*},
        UI::{Input::*, WindowsAndMessaging::*},
    };
    const CONTROL: u32 = WM_APP + 7;
    struct Context {
        app: tauri::AppHandle,
        desired: Arc<AtomicBool>,
        registered: bool,
        locked: bool,
        suspended: bool,
        queue: Vec<InputEvent>,
        dx: i64,
        dy: i64,
        timer: bool,
        absolute: Option<(i32, i32)>,
    }
    pub fn notify(hwnd: isize, close: bool) {
        if hwnd != 0 {
            unsafe {
                PostMessageW(hwnd as HWND, if close { WM_CLOSE } else { CONTROL }, 0, 0);
            }
        }
    }
    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(Some(0)).collect()
    }
    unsafe fn reset(ctx: &mut Context, hwnd: HWND) {
        KillTimer(hwnd, 1);
        ctx.timer = false;
        ctx.queue.clear();
        ctx.dx = 0;
        ctx.dy = 0;
        ctx.absolute = None;
        let _ = ctx
            .app
            .emit_to("main", "clawd:input-batch", vec![InputEvent::Reset]);
    }
    unsafe fn register(ctx: &mut Context, hwnd: HWND) {
        let enabled = ctx.desired.load(Ordering::SeqCst) && !ctx.locked && !ctx.suspended;
        if enabled != ctx.registered {
            let flags = if enabled {
                RIDEV_INPUTSINK
            } else {
                RIDEV_REMOVE
            };
            let target = if enabled { hwnd } else { null_mut() };
            let devices = [
                RAWINPUTDEVICE {
                    usUsagePage: 1,
                    usUsage: 6,
                    dwFlags: flags,
                    hwndTarget: target,
                },
                RAWINPUTDEVICE {
                    usUsagePage: 1,
                    usUsage: 2,
                    dwFlags: flags,
                    hwndTarget: target,
                },
            ];
            if RegisterRawInputDevices(devices.as_ptr(), 2, size_of::<RAWINPUTDEVICE>() as u32) == 0
            {
                crate::app::report(&ctx.app, false, "error", "系统输入注册失败，可从菜单重试");
                return;
            }
            ctx.registered = enabled;
        }
        if !enabled {
            reset(ctx, hwnd);
        }
        crate::app::report(
            &ctx.app,
            enabled,
            if ctx.locked || ctx.suspended {
                "locked"
            } else if enabled {
                "listening"
            } else {
                "paused"
            },
            "",
        );
    }
    unsafe fn schedule(ctx: &mut Context, hwnd: HWND) {
        if !ctx.timer {
            if SetTimer(hwnd, 1, 32, None) != 0 {
                ctx.timer = true;
            } else {
                flush(ctx, hwnd);
            }
        }
    }
    unsafe fn flush(ctx: &mut Context, hwnd: HWND) {
        KillTimer(hwnd, 1);
        ctx.timer = false;
        let mut batch = Vec::with_capacity(ctx.queue.len() + 1);
        if let Some(m) = movement(ctx.dx, ctx.dy) {
            batch.push(m);
        }
        ctx.dx = 0;
        ctx.dy = 0;
        batch.append(&mut ctx.queue);
        if !batch.is_empty() && ctx.registered {
            let _ = ctx.app.emit_to("main", "clawd:input-batch", batch);
        }
    }
    unsafe fn read(ctx: &mut Context, hwnd: HWND, lparam: LPARAM) {
        if !ctx.registered {
            return;
        }
        let mut bytes = 0u32;
        let header = size_of::<RAWINPUTHEADER>() as u32;
        if GetRawInputData(
            lparam as HRAWINPUT,
            RID_INPUT,
            null_mut(),
            &mut bytes,
            header,
        ) == u32::MAX
            || bytes < header
            || bytes > 65536
        {
            return;
        }
        // u64 allocation supplies alignment for RAWINPUTHEADER on both x86/x64.
        let mut data = vec![0u64; (bytes as usize).max(size_of::<RAWINPUT>()).div_ceil(8)];
        if GetRawInputData(
            lparam as HRAWINPUT,
            RID_INPUT,
            data.as_mut_ptr().cast(),
            &mut bytes,
            header,
        ) == u32::MAX
        {
            return;
        }
        let raw = &*(data.as_ptr() as *const RAWINPUT);
        if raw.header.dwType == RIM_TYPEKEYBOARD
            && bytes >= header + size_of::<RAWKEYBOARD>() as u32
        {
            let k = raw.data.keyboard;
            if let Some(event) = key_event(k.MakeCode, k.Flags, k.VKey) {
                push_bounded(&mut ctx.queue, event);
            }
        } else if raw.header.dwType == RIM_TYPEMOUSE
            && bytes >= header + size_of::<RAWMOUSE>() as u32
        {
            let m = raw.data.mouse;
            if m.usFlags & 1 == 0 {
                ctx.dx = ctx.dx.saturating_add(m.lLastX as i64);
                ctx.dy = ctx.dy.saturating_add(m.lLastY as i64);
                ctx.absolute = None;
            } else {
                if let Some((x, y)) = ctx.absolute {
                    ctx.dx += (m.lLastX as i64 - x as i64) / 32;
                    ctx.dy += (m.lLastY as i64 - y as i64) / 32;
                }
                ctx.absolute = Some((m.lLastX, m.lLastY));
            }
            let flags = m.Anonymous.Anonymous.usButtonFlags;
            for (mask, button, down) in [(1, 0, true), (2, 0, false), (4, 2, true), (8, 2, false)] {
                if flags & mask != 0 {
                    push_bounded(&mut ctx.queue, InputEvent::Button { button, down });
                }
            }
        }
        if !ctx.queue.is_empty() || ctx.dx != 0 || ctx.dy != 0 {
            schedule(ctx, hwnd);
        }
    }
    unsafe extern "system" fn wndproc(hwnd: HWND, msg: u32, w: WPARAM, l: LPARAM) -> LRESULT {
        if msg == WM_NCCREATE {
            let create = &*(l as *const CREATESTRUCTW);
            SetWindowLongPtrW(hwnd, GWLP_USERDATA, create.lpCreateParams as isize);
        }
        let ptr = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *mut Context;
        if !ptr.is_null() {
            let ctx = &mut *ptr;
            match msg {
                WM_INPUT => {
                    read(ctx, hwnd, l);
                }
                WM_TIMER if w == 1 => {
                    flush(ctx, hwnd);
                    return 0;
                }
                CONTROL => {
                    register(ctx, hwnd);
                    return 0;
                }
                WM_WTSSESSION_CHANGE => {
                    if w == WTS_SESSION_LOCK as usize {
                        ctx.locked = true;
                    } else if w == WTS_SESSION_UNLOCK as usize {
                        ctx.locked = false;
                    }
                    register(ctx, hwnd);
                    return 0;
                }
                WM_POWERBROADCAST => {
                    if w == PBT_APMSUSPEND as usize {
                        ctx.suspended = true;
                    } else if w == PBT_APMRESUMEAUTOMATIC as usize
                        || w == PBT_APMRESUMESUSPEND as usize
                    {
                        ctx.suspended = false;
                    }
                    register(ctx, hwnd);
                    return 1;
                }
                WM_CLOSE => {
                    DestroyWindow(hwnd);
                    return 0;
                }
                WM_DESTROY => {
                    ctx.desired.store(false, Ordering::SeqCst);
                    register(ctx, hwnd);
                    WTSUnRegisterSessionNotification(hwnd);
                    SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
                    PostQuitMessage(0);
                    return 0;
                }
                _ => {}
            }
        }
        DefWindowProcW(hwnd, msg, w, l)
    }
    pub fn run(
        app: tauri::AppHandle,
        handle: Arc<AtomicIsize>,
        desired: Arc<AtomicBool>,
        stopping: Arc<AtomicBool>,
    ) -> Result<(), String> {
        unsafe {
            let instance = GetModuleHandleW(null());
            let class = wide("BongoClawdLiteRawInput");
            let wc = WNDCLASSW {
                lpfnWndProc: Some(wndproc),
                hInstance: instance,
                lpszClassName: class.as_ptr(),
                ..zeroed()
            };
            RegisterClassW(&wc);
            let mut ctx = Box::new(Context {
                app,
                desired,
                registered: false,
                locked: false,
                suspended: false,
                queue: Vec::with_capacity(64),
                dx: 0,
                dy: 0,
                timer: false,
                absolute: None,
            });
            // Hidden top-level window receives suspend broadcasts as well as session changes.
            let hwnd = CreateWindowExW(
                0,
                class.as_ptr(),
                class.as_ptr(),
                0,
                0,
                0,
                0,
                0,
                null_mut(),
                null_mut(),
                instance,
                ctx.as_mut() as *mut Context as *const _,
            );
            if hwnd.is_null() {
                return Err("无法创建系统输入接收窗口".into());
            }
            handle.store(hwnd as isize, Ordering::SeqCst);
            WTSRegisterSessionNotification(hwnd, NOTIFY_FOR_THIS_SESSION);
            register(&mut ctx, hwnd);
            if stopping.load(Ordering::SeqCst) {
                PostMessageW(hwnd, WM_CLOSE, 0, 0);
            }
            let mut message: MSG = zeroed();
            loop {
                let status = GetMessageW(&mut message, null_mut(), 0, 0);
                if status <= 0 {
                    break;
                }
                TranslateMessage(&message);
                DispatchMessageW(&message);
            }
            handle.store(0, Ordering::SeqCst);
            Ok(())
        }
    }
}
#[cfg(not(windows))]
mod native {
    use super::*;
    pub fn notify(_: isize, _: bool) {}
    pub fn run(
        _: tauri::AppHandle,
        _: Arc<AtomicIsize>,
        _: Arc<AtomicBool>,
        _: Arc<AtomicBool>,
    ) -> Result<(), String> {
        Err("全局输入仅支持 Windows".into())
    }
}
