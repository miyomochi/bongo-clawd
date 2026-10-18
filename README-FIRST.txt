Bongo Clawd Lite · Windows x64 · 0.1.0-preview.1

这是独立的轻量候选版，原 Electron 版本继续保留。

1. 完整解压这个文件夹，双击 Bongo-Clawd-Lite.exe。
2. 需要 Windows 10 / 11 x64 和已安装的 Microsoft Edge WebView2 Runtime。
   微软官方下载：https://developer.microsoft.com/microsoft-edge/webview2/
3. 首次启动会出现设置页；拖住小蟹本体可移动，右键或托盘可打开菜单。
4. 默认空闲 90 秒睡着，设置中可调整或关闭。大小可连续调节。
5. 关闭设置页会释放该窗口；隐藏小蟹仍会留在托盘，完全退出请用托盘菜单。
6. 对比占用时请一次只运行一个版本，详见 COMPARISON.md。

此包已成功交叉编译并通过核心 / 动画检查，但尚未在真实 Windows 上验收。
若打不开，请记录提示内容；若没有提示，请记录是否出现托盘图标。
设置与 Electron 版分开，不会覆盖原配置。

配置位置：%APPDATA%\com.miyo.bongo-clawd-lite\settings.json
不读取输入文字、不保存按键历史；全局监听仅驱动本地动画。
