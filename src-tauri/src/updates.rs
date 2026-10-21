use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Release {
    pub version: String,
    pub download_url: String,
    #[serde(default)]
    pub sha256: String,
    #[serde(default)]
    pub notes: String,
}

pub fn parse_release(bytes: &[u8], current: &str) -> Result<(Release, bool), String> {
    let release: Release = serde_json::from_slice(bytes)
        .map_err(|_| "更新信息格式有误，请稍后重试。".to_string())?;
    let latest = semver::Version::parse(&release.version)
        .map_err(|_| "更新版本号无效。".to_string())?;
    let installed = semver::Version::parse(current)
        .map_err(|_| "当前版本号无效。".to_string())?;
    if !latest.pre.is_empty() && (installed.pre.is_empty()
        || !(latest.pre.as_str() == "beta" || latest.pre.as_str().starts_with("beta."))) {
        return Err("更新信息尚未正式发布。".into());
    }
    let url = &release.download_url;
    if !(url.starts_with("https://raw.githubusercontent.com/miyomochi/bongo-clawd/main/downloads/")
        || url.starts_with("https://github.com/miyomochi/bongo-clawd/releases/download/"))
        || !url.ends_with(".zip")
        || url.contains("..")
        || url.chars().any(|c| !c.is_ascii() || c.is_ascii_control() || c.is_ascii_whitespace() || matches!(c, '%' | '?' | '#' | '\\'))
    {
        return Err("更新下载地址无效。".into());
    }
    if release.sha256.len() != 64 || !release.sha256.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("更新校验值无效。".into());
    }
    if release.notes.len() > 16000 { return Err("更新日志过长。".into()); }
    if !url.ends_with(&format!("Bongo-Clawd-{}-Windows-x64-Setup.zip",release.version)) {
        return Err("更新安装包与版本号不匹配。".into());
    }
    Ok((release, latest > installed))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn manifest(version: &str) -> Vec<u8> {
        serde_json::to_vec(&serde_json::json!({"version":version,"download_url":format!("https://raw.githubusercontent.com/miyomochi/bongo-clawd/main/downloads/Bongo-Clawd-{version}-Windows-x64-Setup.zip"),"sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"})).unwrap()
    }
    #[test]
    fn published_versions_are_compared_numerically() {
        assert!(parse_release(&manifest("0.2.10"), "0.2.9").unwrap().1);
        assert!(!parse_release(&manifest("0.2.1"), "0.2.1").unwrap().1);
        assert!(!parse_release(&manifest("0.2.0"), "0.2.1").unwrap().1);
        assert!(parse_release(&manifest("0.2.1"), "0.2.1-preview.5").unwrap().1);
    }
    #[test]
    fn beta_updates_require_opted_in_beta_installation() {
        assert!(!parse_release(&manifest("0.3.1-beta"), "0.3.1-beta").unwrap().1);
        assert!(parse_release(&manifest("0.3.2-beta"), "0.3.1-beta").unwrap().1);
        assert!(parse_release(&manifest("0.3.1-beta"), "0.3.0").is_err());
        assert!(parse_release(&manifest("0.3.1-beta.2"), "0.3.1-beta.1").unwrap().1);
        assert!(parse_release(&manifest("0.3.1-beta.2"), "0.3.0").is_err());
        assert!(parse_release(&manifest("0.3.1"), "0.3.1-beta.1").unwrap().1);
        assert!(parse_release(&manifest("0.3.1-alpha.2"), "0.3.1-beta.1").is_err());
    }
    #[test]
    fn invalid_or_unpublished_updates_are_not_reported_as_current() {
        assert!(parse_release(b"not json", "0.2.1").is_err());
        assert!(parse_release(&manifest("bad"), "0.2.1").is_err());
        assert!(parse_release(&manifest("0.3.0-preview.1"), "0.2.1").is_err());
        let foreign = br#"{"version":"9.0.0","download_url":"https://example.org/update.zip"}"#;
        assert!(parse_release(foreign, "0.2.1").is_err());
    }
}

/// Local calendar date, not an elapsed 24-hour interval. A failed attempt also
/// counts for today; manual checks never consult this gate.
pub fn daily_check_due(enabled: bool, checked: &str, snoozed: &str, today: &str) -> bool {
    enabled && checked != today && snoozed != today
}
#[cfg(test)]
mod daily_tests {
    use super::*;
    #[test]
    fn checks_once_per_local_day_and_manual_path_is_separate() {
        assert!(daily_check_due(true, "2026-10-19", "", "2026-10-20"));
        assert!(!daily_check_due(true, "2026-10-20", "", "2026-10-20"));
        assert!(!daily_check_due(true, "", "2026-10-20", "2026-10-20"));
        assert!(!daily_check_due(false, "", "", "2026-10-20"));
        assert!(daily_check_due(true, "2026-10-20", "2026-10-20", "2026-10-21"));
    }
}
