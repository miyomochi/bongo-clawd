# Bongo Clawd Lite · 0.1.0-preview.1

独立的 Windows x64 轻量候选版：Tauri + Rust + 系统 WebView2。保留 Electron preview.5 的 SVG 和七个动画模块，替换桌面外壳及全局输入服务。此版成功交叉编译，尚待真实 Windows 验收；不替换已经能用的 Electron 版。

## 运行

完整解压 `Bongo-Clawd-Lite-Windows-x64.zip`，双击 `Bongo-Clawd-Lite.exe`。适用 Windows 10 / 11 x64，需要 Microsoft Edge WebView2 Runtime。运行小蟹不需要 Rust、Node、Python、PowerShell 输入脚本或管理员权限。

首次启动显示设置页。按住小蟹本体、键盘、顶部或底部栏可拖动；右键小蟹或用托盘图标打开菜单。设置页可调 60%～160% 大小、置顶、上下栏和自动睡眠；默认 90 秒睡着。关闭设置页会释放该窗口。隐藏小蟹会留在托盘，完全退出请用托盘菜单。

若系统提示缺少 WebView2，使用微软官方页面 https://developer.microsoft.com/microsoft-edge/webview2/ 安装 Evergreen Runtime 后重试。本包不捆绑该浏览器运行时，也不会自动下载安装它。因此小包体不等于零浏览器开销。

配置单独保存在 `%APPDATA%\com.miyo.bongo-clawd-lite\settings.json`；WebView2 缓存由 Tauri 管理。此版不读取或覆盖 Electron 配置。HTML 实验台仍可独立打开，托盘菜单也提供入口。

## 功能保持

- 物理键位亮灯、左右手和双手敲击，右手鼠标与左手键盘兼容。
- 普通、快速、更忙、喘气恢复、随机眨眼、探头、伸懒腰、睡眠、惊醒与心虚假敲。
- 原生窗口拖动、右键菜单、托盘、暂停、重试输入、独立设置页和占用快照。
- 不解析输入文字，不读取剪贴板，不记录按键历史，不上传输入。

输入改为同进程 Rust Raw Input：系统消息唤醒，有输入时最多约每 32ms 合并发送一次；无输入时没有该合并定时器。队列最多 512 条，溢出会清空按住状态。锁屏或挂起时停止注册，恢复后重新连接。画面动画没有为了跑分而删减。

## 对比与验证

先看 `COMPARISON.md`。已完成的构建与检查见 `VALIDATION.md`；Windows 全局输入、触摸板右键、多屏拖动和实际 RAM/CPU 仍需要实机检查。不要把候选版的“能编译”当成这些行为已获验证。

源码中 `Clawd-lab.html` 是保留的独立实验版。`web/core/` 与 Electron 基线的十个文件逐字节相同，哈希记录于 `baseline-animation-manifest.json`。

## 在 Windows 从源码构建

先安装 Rust 1.99.1、Visual Studio C++ Build Tools（含 MSVC x64 和 Windows SDK）、WebView2 Runtime。打开本目录，在 PowerShell 运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-windows.ps1
```

脚本只构建及打包本地项目，不安装依赖或改系统设置。Cargo 首次构建会下载锁定依赖，耗时和开发工具占用不属于运行小蟹的开销。前端是本地原生 JS，无 npm 构建步骤。输出在 `dist`。

验证命令（在本目录）：

```text
cargo test --manifest-path core-tests/Cargo.toml --locked
node --test tests/desktop.test.mjs
python scripts/verify-assets.py
```

`tests/browser-adapter.cjs` 是可选的 Chromium 桥接模拟检查：需要单独安装 `playwright-core@1.56.1` 并设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指向 Chromium。它不模拟 Windows 原生 API 的真实行为。

## 结构

`src-tauri/src/app.rs` 管窗口、菜单和配置；`input.rs` 管 Raw Input；`protocol.rs` 管键位与事件；`preferences.rs` 管设置验证；`resources.rs` 仅在用户请求时统计占用。`web/lite-bridge.js` 适配桌面接口，`web/core/` 保留原动画。后续功能先进入 HTML 实验台，再同步到桌面候选版。
