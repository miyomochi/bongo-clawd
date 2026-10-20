use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Release {
    pub version: String,
    pub download_url: String,
}

pub fn parse_release(bytes: &[u8], current: &str) -> Result<(Release, bool), String> {
    let release: Release = serde_json::from_slice(bytes)
        .map_err(|_| "更新信息格式有误，请稍后重试。".to_string())?;
    let latest = semver::Version::parse(&release.version)
        .map_err(|_| "更新版本号无效。".to_string())?;
    let installed = semver::Version::parse(current)
        .map_err(|_| "当前版本号无效。".to_string())?;
    if !latest.pre.is_empty() {
        return Err("更新信息尚未正式发布。".into());
    }
    let url = &release.download_url;
    if !(url.starts_with("https://raw.githubusercontent.com/miyomochi/bongo-clawd/main/downloads/")
        || url.starts_with("https://github.com/miyomochi/bongo-clawd/releases/download/"))
        || !url.ends_with(".zip")
        || url.contains("..")
    {
        return Err("更新下载地址无效。".into());
    }
    Ok((release, latest > installed))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn manifest(version: &str) -> Vec<u8> {
        serde_json::to_vec(&serde_json::json!({"version":version,"download_url":"https://raw.githubusercontent.com/miyomochi/bongo-clawd/main/downloads/Setup.zip"})).unwrap()
    }
    #[test]
    fn published_versions_are_compared_numerically() {
        assert!(parse_release(&manifest("0.2.10"), "0.2.9").unwrap().1);
        assert!(!parse_release(&manifest("0.2.1"), "0.2.1").unwrap().1);
        assert!(!parse_release(&manifest("0.2.0"), "0.2.1").unwrap().1);
        assert!(parse_release(&manifest("0.2.1"), "0.2.1-preview.5").unwrap().1);
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
