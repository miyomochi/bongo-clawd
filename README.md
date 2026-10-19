# Bongo Clawd 🦀

基于bongo cat灵感的Clawd小桌宠，个人自娱自乐产物😽……

Clawd的动作基于鼠标，键盘输入进行映射、点亮按键。认真快打时有忙碌动画，停下来会喘口气；空闲久了会左顾右盼、伸个懒腰，再悄悄打个盹。晃动鼠标叫醒Clawd，打工蟹会心虚地快敲一会。

## 下载与使用

1. 下载 [Windows x64 运行包](downloads/Bongo-Clawd-Lite-Windows-x64.zip?raw=true)。
2. 完整解压，双击 `Bongo-Clawd-Lite.exe`。
3. 第一次打开会显示设置页，按喜好调整后就能使用。

支持 **Windows 10 / 11，x64**，需要系统安装 Microsoft Edge WebView2 Runtime。若提示缺少运行时，可从 [微软官方页面](https://developer.microsoft.com/microsoft-edge/webview2/) 安装 Evergreen Runtime。运行程序不需要额外安装开发工具。

## 操作和设置

- 打字或使用鼠标时，Clawd也会跟着动；支持双手敲击、键鼠同时使用，静息有彩蛋动画~
- Clawd本体、键盘或上下栏都可以进行位置拖动。
- 右键小蟹本体，或通过托盘菜单打开设置。
- 可调大小、窗口置顶、上下栏显示，以及是否自动睡眠和等待时间；默认空闲 90 秒睡着。
- 隐藏窗口后可从托盘找回；彻底退出使用托盘菜单。

`Clawd-lab.html` 是可单独打开的网页，只响应网页内的操作，用于观看动画演示和进行内容实验。

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
