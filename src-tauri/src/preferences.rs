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
    pub accessory: String,
    pub breathing_enabled: bool,
    pub statistics_enabled: bool,
    /// Right-hand settings / decorations / pause blocks (UI v2). Missing in old files → shown.
    pub side_buttons: bool,
    pub mirrored: bool,
    /// Speech bubble for status lines (小蟹台词). Missing in old files → on.
    pub bubble_lines: bool,
    /// Small, zoned reach; false keeps the original short-hand animation.
    pub directional_arms: bool,
}
/// Logical main-window size (UI v2: transparent, no top/bottom bars). Keep in sync with web/desktop-renderer.js.
pub const MAIN_WIDTH: f64 = 388.0;
pub const MAIN_WIDTH_NO_SIDE: f64 = 352.0;
pub const MAIN_HEIGHT: f64 = 300.0;
/// Extra height while the decorations card is open below the pet.
pub const DECORATIONS_HEIGHT: f64 = 166.0;
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
            accessory: "none".into(),
            breathing_enabled: true,
            statistics_enabled: false,
            side_buttons: true,
            mirrored: false,
            bubble_lines: true,
            directional_arms: true,
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
        if !matches!(
            self.accessory.as_str(),
            "none" | "headphones" | "cat-headphones" | "sprout" | "duck"
        ) {
            self.accessory = "none".into();
        }
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
        boolean!("breathingEnabled", breathing_enabled);
        boolean!("statisticsEnabled", statistics_enabled);
        boolean!("sideButtons", side_buttons);
        boolean!("mirrored", mirrored);
        boolean!("bubbleLines", bubble_lines);
        boolean!("directionalArms", directional_arms);
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
        if let Some(value) = patch.get("accessory").and_then(Value::as_str) {
            if matches!(
                value,
                "none" | "headphones" | "cat-headphones" | "sprout" | "duck"
            ) {
                self.accessory = value.into();
            }
        }
        self.sanitize();
    }
    /// The statistics line sits inside the pet area and the bars no longer exist, so only the
    /// side-button column changes the size. `showTopBar` / `showBottomBar` are kept for old files only.
    pub fn dimensions(&self) -> (f64, f64) {
        (
            if self.side_buttons {
                MAIN_WIDTH
            } else {
                MAIN_WIDTH_NO_SIDE
            } * self.scale,
            MAIN_HEIGHT * self.scale,
        )
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_keep_ninety_second_sleep() {
        let p = Preferences::default();
        assert_eq!(p.sleep_seconds, 90);
        assert_eq!(p.dimensions(), (388.0, 300.0));
        assert!(p.side_buttons && p.bubble_lines);
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
        let (w, h) = p.dimensions();
        assert!((w - 388.0 * 1.6).abs() < 1e-9 && h == 480.0, "{w}x{h}");
    }
    #[test]
    fn accessory_migrates_and_rejects_unknown_values() {
        let mut p: Preferences = serde_json::from_str(r#"{"scale":1.0}"#).unwrap();
        assert_eq!(p.accessory, "none");
        p.patch(&serde_json::json!({"accessory":"duck"}));
        p.patch(&serde_json::json!({"accessory":"unknown"}));
        assert_eq!(p.accessory, "duck");
        p.accessory = "unknown".into();
        p.sanitize();
        assert_eq!(p.accessory, "none");
    }
    #[test]
    fn optional_counters_and_breathing_migrate_without_saving_counts() {
        let mut p: Preferences = serde_json::from_str(r#"{"scale":1}"#).unwrap();
        assert!(p.breathing_enabled);
        assert!(!p.statistics_enabled);
        p.patch(
            &serde_json::json!({"statisticsEnabled":true,"breathingEnabled":false,"total":1234}),
        );
        assert!(!p.breathing_enabled);
        assert!(p.statistics_enabled);
        assert_eq!(p.dimensions(), (388.0, 300.0));
        assert!(serde_json::to_value(&p).unwrap().get("total").is_none());
        p.patch(&serde_json::json!({"showTopBar":false,"showBottomBar":false,"scale":1.17}));
        assert!((p.dimensions().1 - 351.0).abs() < 0.001);
    }
    #[test]
    fn side_buttons_and_bubble_lines_migrate_on_and_toggle() {
        let mut p: Preferences =
            serde_json::from_str(r#"{"scale":1,"showTopBar":false,"statisticsEnabled":true}"#)
                .unwrap();
        assert!(p.side_buttons);
        assert!(p.bubble_lines);
        p.patch(&serde_json::json!({"sideButtons":false,"bubbleLines":false}));
        assert!(!p.side_buttons && !p.bubble_lines);
        assert_eq!(p.dimensions(), (352.0, 300.0));
        p.patch(&serde_json::json!({"sideButtons":"yes","bubbleLines":1}));
        assert!(!p.side_buttons && !p.bubble_lines);
        let v = serde_json::to_value(&p).unwrap();
        assert_eq!(v["sideButtons"], false);
        assert_eq!(v["bubbleLines"], false);
    }
    #[test]
    fn directional_arms_migrate_on_and_can_keep_original_motion() {
        let mut p: Preferences = serde_json::from_str(r#"{"scale":1}"#).unwrap();
        assert!(p.directional_arms);
        p.patch(&serde_json::json!({"directionalArms":false}));
        p.patch(&serde_json::json!({"directionalArms":"true"}));
        assert!(!p.directional_arms);
        assert_eq!(serde_json::to_value(&p).unwrap()["directionalArms"], false);
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
