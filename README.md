# Bongo Clawd 🦀

一只陪你敲键盘的小蟹。

打开后，小蟹会根据键盘和鼠标操作抬起小爪、点亮按键。认真快打时忙得冒汗，停下来会喘口气；空闲久了偷偷看看、伸个懒腰，再打个盹。被叫醒时还会吓一跳，心虚地快速敲上一会。

## 下载与使用

1. 下载 [Windows x64 运行包](downloads/Bongo-Clawd-Lite-Windows-x64.zip?raw=true)。
2. 完整解压，双击 `Bongo-Clawd-Lite.exe`。
3. 第一次打开会显示设置页，按喜好调整后就能使用。

支持 **Windows 10 / 11，x64**，需要系统安装 Microsoft Edge WebView2 Runtime。若提示缺少运行时，可从 [微软官方页面](https://developer.microsoft.com/microsoft-edge/webview2/) 安装 Evergreen Runtime。运行小蟹不需要安装开发工具。

## 操作和设置

- 在其他软件里打字或使用鼠标，小蟹也会跟着动；支持双手敲击、键鼠同时使用。
- 按住小蟹本体、键盘或上下栏，可以拖动位置。
- 右键小蟹，或通过托盘菜单打开设置。
- 可调大小、窗口置顶、上下栏显示，以及是否自动睡眠和等待时间；默认空闲 90 秒睡着。
- 隐藏窗口后可从托盘找回；彻底退出使用托盘菜单。

`Clawd-lab.html` 是可单独打开的网页实验台，只响应网页内的操作。

## 隐私

键鼠输入仅用于本地动画。不解析输入文字，不读取剪贴板，不保存按键历史，不上传输入。

设置保存在 `%APPDATA%\com.miyo.bongo-clawd-lite\settings.json`。

## 版本与开发

`v0.1.0` 是第一个稳定归档，包含敲击、忙碌、恢复、探头、睡眠和惊醒等基础动作。墨镜、开心 / 梦境气泡与头部装饰将在后续版本中加入。

画面采用纯 SVG 像素风格，桌面程序使用 Tauri、Rust 与系统 WebView2。动画源码按模块放在 `web/core/`，桌面功能在 `src-tauri/src/`。

- [构建与测试说明](docs/ORIGINAL-BUILD-NOTES.md)
- [验证记录与适用范围](VALIDATION.md)
- [版本记录](CHANGELOG.md)

## 致谢与许可

本项目为非官方同好作品，Clawd 角色及相关品牌属于各自权利人。

原创代码许可见 [LICENSE-CODE.txt](LICENSE-CODE.txt)，第三方说明见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
