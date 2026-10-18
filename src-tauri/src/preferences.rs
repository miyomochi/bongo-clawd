use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct Preferences {
    pub scale: f64,
    pub always_on_top: bool,
    pub show_top_bar: bool,
    pub show_bottom_bar: bool,
    pub show_on_startup: bool,
    pub sleep_enabled: bool,
    pub sleep_seconds: u32,
    pub bounds: Option<Point>,
}
impl Default for Preferences {
    fn default() -> Self {
        Self {
            scale: 1.0,
            always_on_top: true,
            show_top_bar: true,
            show_bottom_bar: true,
            show_on_startup: true,
            sleep_enabled: true,
            sleep_seconds: 90,
            bounds: None,
        }
    }
}
impl Preferences {
    pub fn sanitize(&mut self) {
        self.scale = if self.scale.is_finite() {
            (self.scale.clamp(0.6, 1.6) * 100.0).round() / 100.0
        } else {
            1.0
        };
        self.sleep_seconds = self.sleep_seconds.clamp(30, 3600);
    }
    pub fn patch(&mut self, patch: &Value) {
        macro_rules! boolean {
            ($key:literal,$field:ident) => {
                if let Some(b) = patch.get($key).and_then(Value::as_bool) {
                    self.$field = b;
                }
            };
        }
        boolean!("alwaysOnTop", always_on_top);
        boolean!("showTopBar", show_top_bar);
        boolean!("showBottomBar", show_bottom_bar);
        boolean!("showOnStartup", show_on_startup);
        boolean!("sleepEnabled", sleep_enabled);
        if let Some(n) = patch.get("scale").and_then(Value::as_f64) {
            if n.is_finite() {
                self.scale = n;
            }
        }
        if let Some(n) = patch.get("sleepSeconds").and_then(Value::as_f64) {
            if n.is_finite() {
                self.sleep_seconds = n.clamp(30.0, 3600.0).round() as u32;
            }
        }
        self.sanitize();
    }
    pub fn dimensions(&self) -> (f64, f64) {
        (
            440.0 * self.scale,
            (335.0
                - if self.show_top_bar { 0.0 } else { 39.0 }
                - if self.show_bottom_bar { 0.0 } else { 31.0 })
                * self.scale,
        )
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_match_electron() {
        let p = Preferences::default();
        assert_eq!(p.sleep_seconds, 90);
        assert_eq!(p.dimensions(), (440.0, 335.0));
    }
    #[test]
    fn patch_only_accepts_known_typed_fields() {
        let mut p = Preferences::default();
        p.patch(&serde_json::json!({"scale":1.17,"sleepSeconds":120,"showTopBar":false,"bounds":{"x":999,"y":999},"sleepEnabled":"false"}));
        assert_eq!(p.scale, 1.17);
        assert_eq!(p.sleep_seconds, 120);
        assert!(p.sleep_enabled);
        assert!(p.bounds.is_none());
        assert!(!p.show_top_bar);
    }
    #[test]
    fn bounds_and_dimensions_are_sanitized() {
        let mut p = Preferences::default();
        p.patch(&serde_json::json!({"scale":9,"sleepSeconds":0,"showTopBar":false,"showBottomBar":false}));
        assert_eq!(p.scale, 1.6);
        assert_eq!(p.sleep_seconds, 30);
        assert_eq!(p.dimensions(), (704.0, 424.0));
    }
    #[test]
    fn preferences_round_trip() {
        let mut p = Preferences::default();
        p.patch(&serde_json::json!({"scale":0.91,"sleepEnabled":false}));
        assert_eq!(
            serde_json::from_str::<Preferences>(&serde_json::to_string(&p).unwrap()).unwrap(),
            p
        );
    }
}
