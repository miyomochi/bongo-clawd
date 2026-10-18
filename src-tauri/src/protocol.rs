use serde::Serialize;
#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum InputEvent {
    Key { code: &'static str, down: bool },
    Move { dx: f64, dy: f64 },
    Button { button: u8, down: bool },
    Reset,
}
pub fn key_event(scan: u16, flags: u16, vk: u16) -> Option<InputEvent> {
    if vk == 255 || scan == 0xff {
        return None;
    }
    let code = if vk == 19 && flags & 4 != 0 {
        Some("Pause")
    } else {
        physical_code(scan, flags & 2 != 0)
    }?;
    Some(InputEvent::Key {
        code,
        down: flags & 1 == 0,
    })
}
pub fn movement(x: i64, y: i64) -> Option<InputEvent> {
    let dx = (x as f64 / 18.0).clamp(-4.0, 4.0);
    let dy = (y as f64 / 18.0).clamp(-3.0, 3.0);
    if dx.abs() + dy.abs() < 0.15 {
        None
    } else {
        Some(InputEvent::Move { dx, dy })
    }
}
pub fn push_bounded(queue: &mut Vec<InputEvent>, event: InputEvent) {
    if queue.len() >= 512 {
        queue.clear();
        queue.push(InputEvent::Reset);
    }
    queue.push(event);
}
include!("keymap.rs");
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn physical_sides_and_pause_match() {
        assert_eq!(
            key_event(29, 0, 17),
            Some(InputEvent::Key {
                code: "ControlLeft",
                down: true
            })
        );
        assert_eq!(
            key_event(29, 2, 17),
            Some(InputEvent::Key {
                code: "ControlRight",
                down: true
            })
        );
        assert_eq!(
            key_event(69, 4, 19),
            Some(InputEvent::Key {
                code: "Pause",
                down: true
            })
        );
        assert!(key_event(255, 0, 255).is_none());
    }
    #[test]
    fn movement_is_bounded_and_tiny_noise_is_skipped() {
        assert!(movement(1, 1).is_none());
        assert_eq!(
            movement(900, -900),
            Some(InputEvent::Move { dx: 4.0, dy: -3.0 })
        );
    }
    #[test]
    fn overflow_clears_stuck_keys() {
        let mut q = vec![];
        for _ in 0..513 {
            push_bounded(
                &mut q,
                InputEvent::Key {
                    code: "KeyA",
                    down: true,
                },
            );
        }
        assert_eq!(q.len(), 2);
        assert_eq!(q[0], InputEvent::Reset);
    }
    #[test]
    fn serialized_events_never_include_text() {
        let s = serde_json::to_value(key_event(30, 0, 65).unwrap()).unwrap();
        assert_eq!(
            s,
            serde_json::json!({"type":"key","code":"KeyA","down":true})
        );
    }
    #[test]
    fn all_keys_match_frozen_map() {
        let maps: serde_json::Value = serde_json::from_str(include_str!("keymap.json")).unwrap();
        let mut codes = std::collections::BTreeSet::new();
        for (name, ext) in [("base", false), ("extended", true)] {
            for (scan, label) in maps[name].as_object().unwrap() {
                let code = physical_code(scan.parse().unwrap(), ext).unwrap();
                assert_eq!(code, label.as_str().unwrap());
                codes.insert(code);
            }
        }
        codes.insert("Pause");
        assert_eq!(codes.len(), 87);
    }
}
