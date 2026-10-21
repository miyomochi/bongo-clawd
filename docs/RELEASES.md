# 发布与历史版本

用户下载入口是 [GitHub Releases](https://github.com/miyomochi/bongo-clawd/releases)。`Latest` 指向最新稳定版，Beta 标记 `Pre-release`。运行包放在各版本的 Assets 中，源码 ZIP/TAR 由 GitHub 提供。

## 当前归档

| 标签 | 通道 | 原始构建 |
| --- | --- | --- |
| v0.3.0 | 最新稳定版 | 安装包、便携包 |
| v0.3.1-beta.1 | 不稳定试验版 | 安装包、便携包 |
| v0.2.1 | 历史稳定版 | 安装包、便携包 |
| v0.2.0-preview.5 | 历史预览版 | 便携包 |
| v0.1.0 | 初版稳定归档 | Lite 便携包，内部版本仍为 0.1.0-preview.1 |

初版标签沿用当时 CHANGELOG 的稳定归档名称，附件保留原始内部版本号。0.2.0 阶段只保留了 preview.5 包，因此标签使用实际构建号。没有原始附件的中间预览版本仅保留在 CHANGELOG，不创建虚假的运行包。

所有归档附件沿用 `downloads/` 的原始字节，每个 Release 单独提供 SHA256SUMS.txt。`releases/catalog.json` 固定源提交、通道、附件名和校验值；对应 Markdown 保存说明。稳定版与 Beta 的标签分别指向各自的源码，不把稳定版源码误标成 Beta。

## 发布步骤

1. 完成应用验证，保存版本对应的源提交与原始构建；更新 `releases/catalog.json` 和该版说明。每个新版本使用新标签，不替换既有发布附件。
2. 执行 `python scripts/publish-releases.py --tag v版本号`，只验证，不发布。脚本检查源码版本、ZIP 完整性、SHA-256 和 git 中的归档字节。
3. 在 GitHub Actions 的 **Publish archived releases** 中手动运行，选择准确标签。首次归档专用分支 `publish/release-catalog-20261021` 的推送也可触发导入；普通 main 推送不会发布或重新打包。
4. 工作流先建草稿并上传附件，核对远端 digest 后发布；仅 catalog 中指定的稳定版可成为 Latest。再次运行会核对既有文件，不覆盖附件或移动已有标签。
5. 核对版本页、Latest、Pre-release 和下载，再更新 README 与更新元数据。稳定版和 Beta 的更新清单仍分别维护。

本次归档保留 `downloads/` 与原更新清单的 URL，兼容旧客户端和已分享的链接。整理 Releases 不触发 Windows 编译，也不改变运行程序。
