# 构建与项目结构

## Windows 构建

需要 Rust 1.99.1、MSVC x64 Build Tools 和 Windows SDK。运行时使用系统 Microsoft Edge WebView2；不需要 npm 前端打包。

在项目根目录执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-windows.ps1
```

生成的运行包位于 `dist/`。依赖版本由 `src-tauri/Cargo.lock` 锁定。

## 前端与素材

- `web/core/`：动画控制、键鼠映射、装饰和动作状态。
- `web/clawd-scene.svg` / `web/rig-data.json`：桌面场景与动作素材。
- `web/desktop-renderer.js` / `web/button-press.js`：桌面界面、台词、统计与按钮反馈。
- `web/settings*`：设置界面。
- `src-tauri/src/`：Windows 输入、配置、托盘、窗口和内存统计。
- `tests/` / `core-tests/`：前端模拟及 Rust 核心检查。

修改动画模块后，运行 `python scripts/build-frontend.py` 更新 bundle 与内嵌场景。不要手工单独修改生成的 `web/core/clawd.bundle.js`。

修改应用/托盘小图标时，编辑 `src-tauri/icons/icon.svg`，再运行 `python scripts/build-icon.py` 生成 PNG / ICO。

## 检查

```text
node --test tests/*.test.mjs
cargo test --manifest-path core-tests/Cargo.toml --locked
python scripts/verify-assets.py
```

素材基线是显式记录的审阅结果；设计发生变更时，应先检查实际视觉效果，再更新相应清单。

可选浏览器桥接检查需要 `playwright-core` 和 Chromium：设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 后运行 `node tests/browser-adapter.cjs`。这些检查模拟 Tauri 桥接，不替代 Windows 实机的 Raw Input、托盘、多屏 DPI 和资源占用验证。

`Clawd-lab.html` 是基础动画实验页，独立于当前桌面功能。早期构建资料留在 `ORIGINAL-BUILD-NOTES.md` 中，当前操作以本文为准。
