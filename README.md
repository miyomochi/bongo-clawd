# Bongo Clawd

![Clawd 戴着天蓝耳机敲键盘，开心地冒出爱心泡](docs/assets/clawd-demo.gif)

基于 bongo cat 灵感所构建的Clawd小桌宠，个人自娱自乐产物😽让Clawd来陪你码字吧！

*ps:如果小蟹一动不动，请查看是否关闭了全局键鼠联动或者有未关闭的菜单页

**仍在摸索发布页布局和设计…导致有点乱,致歉!**

Clawd获得一个桌面小工位！可以陪你敲键盘，移动鼠标和敲击键盘都有动作映射(尚未做到对多种型号键盘不同键位的适配orz)。详情可看下方介绍。

当前稳定版：**0.3.0**，支持 **Windows 10 / 11 x64**。

[最新稳定版](https://github.com/miyomochi/bongo-clawd/releases/latest) · [Beta 试验版](https://github.com/miyomochi/bongo-clawd/releases/tag/v0.3.1-beta.1) · [全部版本与历史下载](https://github.com/miyomochi/bongo-clawd/releases)

## 先试试看

想先看看小蟹动起来？😺 [下载动画体验包（ZIP）](https://raw.githubusercontent.com/miyomochi/bongo-clawd/main/downloads/Bongo-Clawd-animation-trial.zip)，解压后用浏览器打开里面的 `Clawd-lab.html` 无需安装可看动画。

实验页只响应网页内的操作，适合体验基础动画；更新随缘，完整功能以 Windows 桌面版为准。

## 下载与使用

**Windows 安全提示**：这是个人同好项目，暂未购买代码签名证书(对我来说有点昂贵了TT)。安装包及便携版中的 EXE 未进行数字签名，Windows 可能进行警告，**想使用要在更多信息里允许一下**。只是请确认文件来自本仓库，并按需核对 [SHA-256 校验值](downloads/SHA256SUMS.txt)，再自行决定是否运行。

1. 下载对应版本 [Windows x64 安装包]。
2. 解压后运行 `Bongo-Clawd-0.3.0-Windows-x64-Setup.exe`，选择安装目录，默认创建桌面快捷方式。
3. 若使用版本未引入自动更新,需要先卸载旧版,再手动安装新版,个人设置会保留。

此为压缩包版,解压后在文件内双击EXE启动,按需取用[便携版运行包（免安装 ZIP）](https://github.com/miyomochi/bongo-clawd/releases/download/v0.3.0/Bongo-Clawd-0.3.0-Windows-x64.zip)，完整解压后双击 `Bongo-Clawd.exe`。

！运行该程序需要系统已安装 Microsoft Edge WebView2 Runtime。若提示缺少运行时，可从 [微软官方页面](https://developer.microsoft.com/microsoft-edge/webview2/) 安装 Evergreen Runtime。

历史版本已整理到 [Releases 版本索引](https://github.com/miyomochi/bongo-clawd/releases)，包括 [0.2.1](https://github.com/miyomochi/bongo-clawd/releases/tag/v0.2.1)、[0.2.0-preview.5](https://github.com/miyomochi/bongo-clawd/releases/tag/v0.2.0-preview.5) 和 [0.1.0 初版归档](https://github.com/miyomochi/bongo-clawd/releases/tag/v0.1.0)。每版单独保留更新说明、原始运行包和校验值；旧包仅供回退参考。

在版本页底部展开 **Assets**：`Setup.zip` 是安装包，另一个 Windows ZIP 是便携版；`Source code` 是源码，不能直接运行。初版沿用内部版本号 `0.1.0-preview.1` 的 Lite 原始构建，程序名为 `Bongo-Clawd-Lite.exe`。

## 版本说明及更新日志
历次更新说明与旧版下载见 Releases⁠页，完整开发记录见 CHANGELOG。

## 小蟹会做什么

- **戳一戳**：轻点小蟹身体，它会歪头挠挠、害羞冒爱心、果冻弹弹或眯眼摇摇唱歌；右击和拖拽单独处理。
- **手臂方向感**：按键按远近、内外分区，轻微伸手；在设置 → 外观关闭后沿用原来的固定位置小短手。
- **镜像工位**：小蟹、键鼠与操作按钮一起换边；统计条保留翻转后的透视，数字和台词保持正常方向。
- **系统设置**：可开关自启动、手动检查更新、打开卸载向导。
- **键鼠联动**：按键会点亮对应键位，小蟹跟着抬手、敲击；支持双手打字以及键鼠同时使用。
- **忙碌与休息**：持续快打时进入忙碌状态，放慢后Clawd缓口气；句子之间短暂停顿有缓冲，不会立即反复切换。
- **空闲小动作**：呼吸、左右张望、伸懒腰。默认空闲 90 秒后睡觉，可调整等待时间或关闭自动入睡。
- **惊醒装忙**：睡着后被键鼠叫醒，会心虚地赶紧敲一会，再继续工作。
- **待机状态可能触发**：戴墨镜、笑眯眯冒出想法泡，睡着时还会做梦。(触发频率不是很高，彩蛋性质)
- **头部装饰**：天蓝耳机、粉色猫耳耳机、树苗、小黄鸭，每件都有小动画。比较简单，请期待后续更新~
- **简短台词**：一般出现在状态变化时，会在头顶显示气泡；遇到动画自带的想法泡会先让位。可在设置中关闭。
- **可选敲击统计**：在键盘下方显示本次敲击次数，以及近 60 秒的平均敲击速率。

## 怎么操作

默认右侧的三个按钮，从上到下是 **设置、装饰、暂停**。按住Clawd可以拖动整个工位；右键Clawd本体或托盘图标打开快捷栏。

| 入口 | 功能 |
| --- | --- |
| 设置 | 调整大小、镜像、始终置顶、侧边按钮、台词、呼吸、入睡时间、统计及系统设置 |
| 装饰 | 点选立即试穿；「戴上」保存，「取消」恢复原来的装扮 |
| 暂停 | 收起桌宠，显示「已暂停」小卡片；点一下继续，按住卡片可拖动 |
| 隐藏 | 收进托盘；隐藏期间仍保持键鼠联动与已开启的统计 |
| 显示小蟹 | 将隐藏的桌宠唤回；也可以双击托盘图标找回 |
| 退出 | 完全关闭程序，结束本次统计 |

打开设置或装饰菜单时，Clawd会暂停，调整期间的键鼠操作不会补播或计入统计。此前状态保留。

装饰选中后播放试穿动画；已确认的装饰下次启动会恢复，但不会自动重播动画。

侧边按钮可以在设置或右键菜单中隐藏；隐藏后仍可从右键和托盘菜单访问功能。

**当前菜单说明**：「显示小蟹」是指整个程序显示。

设置底部的「启动时打开设置」属于旧版非安装包的遗留问题；**目前点击桌面快捷方式进行启动将默认唤出设置。导致按钮只在直接通过.exe启动时有作用,后续会修复。**Windows 开机自启动在「系统」页单独控制，自启动只显示小蟹不弹菜单。

重启程序时，小蟹回到主屏幕可用区域的右下角，避开任务栏；运行中仍可自由拖动。

## 敲击统计与隐私

统计默认关闭。开启后显示 **本次敲击次数** 和 **近 60 秒次数/分**；速率包含空闲时间，开启不足一分钟也不会按短时速度外推。

- 只累计实际键盘按下，包括修饰键；长按自动连发只计一次。
- 鼠标操作、动画中的模拟敲击不计入。
- 暂停、打开调整菜单或锁屏时不累计；隐藏到托盘仍累计。
- 次数与速度仅保存在内存中，关闭统计或完全退出程序即清零，不跨次保存。

仅在「检查更新」时联网查询公开版本信息；检测到新版后，由你确认是否进行下载。

键鼠事件只用于本地动画与上述聚合计数。**不解析输入文字、不读取剪贴板、不保存按键历史、不上传输入。** 

设置会自动保存至 `%APPDATA%\com.miyo.bongo-clawd-lite\settings.json`，包含外观、装饰和功能开关；沿用旧 Lite 版的配置路径。

## 开发与版本

画面采用纯 SVG 像素风格，桌面程序使用 Tauri、Rust 与系统 WebView2。动画模块位于 `web/core/`，Windows 桌面功能位于 `src-tauri/src/`。


- [构建与项目结构](docs/BUILD.md)
- [验证记录](VALIDATION.md)
- [版本记录](CHANGELOG.md)
- [发布与历史版本维护](docs/RELEASES.md)
- [资源占用的比较口径](COMPARISON.md)

## 致谢与许可

本项目为非官方同好作品，Clawd 角色及相关品牌属于各自权利人。小蟹这个萌！你是谁?请支持我们Clawd。

原创代码许可见 [LICENSE-CODE.txt](LICENSE-CODE.txt)，第三方说明见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

### 发布通道

- **稳定版 0.3.0**：可选的小幅手臂方向感，以及正式采用的戳一戳互动。保留手动检查更新。
- **beta 0.3.1-beta.1**：包含稳定版功能。额外增加自动检查、下载校验、安装与动画。未经实机试验更新功能。
- 稳定版只读取正式更新，不会主动切换到 beta。

所选择试验版,有bug请与我反馈。 **不稳定 Beta 0.3.1-beta.1**：[安装包](https://github.com/miyomochi/bongo-clawd/releases/download/v0.3.1-beta.1/Bongo-Clawd-0.3.1-beta.1-Windows-x64-Setup.zip) · [免安装包](https://github.com/miyomochi/bongo-clawd/releases/download/v0.3.1-beta.1/Bongo-Clawd-0.3.1-beta.1-Windows-x64.zip)。Beta 与稳定版共用安装目录和配置，替换使用。[功能、检查结果及当前限制](docs/BETA-0.3.1-beta.1.md)。
