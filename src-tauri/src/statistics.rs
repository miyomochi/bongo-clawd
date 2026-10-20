//! Volatile aggregate counters. No key identities, text, or event log is stored here.
use serde::Serialize;
use std::{collections::VecDeque, time::Instant};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub total: u64,
    pub per_minute: u64,
}
pub struct Statistics {
    enabled: bool,
    total: u64,
    epoch: Instant,
    // At most 60 one-second aggregate buckets, including idle seconds in the denominator.
    buckets: VecDeque<(u64, u64)>,
}
impl Statistics {
    pub fn new(enabled: bool) -> Self {
        Self {
            enabled,
            total: 0,
            epoch: Instant::now(),
            buckets: VecDeque::new(),
        }
    }
    pub fn set_enabled(&mut self, enabled: bool) {
        if self.enabled != enabled {
            self.total = 0;
            self.buckets.clear();
            self.epoch = Instant::now();
        }
        self.enabled = enabled;
    }
    fn expire(&mut self, second: u64) {
        while self
            .buckets
            .front()
            .is_some_and(|(at, _)| second.saturating_sub(*at) >= 60)
        {
            self.buckets.pop_front();
        }
    }
    fn record_at(&mut self, second: u64) {
        if !self.enabled {
            return;
        }
        self.expire(second);
        self.total = self.total.saturating_add(1);
        if let Some((_, count)) = self.buckets.back_mut().filter(|(at, _)| *at == second) {
            *count = count.saturating_add(1);
        } else {
            self.buckets.push_back((second, 1));
        }
    }
    pub fn record(&mut self) {
        self.record_at(self.epoch.elapsed().as_secs());
    }
    fn snapshot_at(&mut self, second: u64) -> Snapshot {
        self.expire(second);
        Snapshot {
            total: self.total,
            per_minute: self.buckets.iter().map(|(_, count)| count).sum(),
        }
    }
    pub fn snapshot(&mut self) -> Snapshot {
        self.snapshot_at(self.epoch.elapsed().as_secs())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn off_is_empty_and_toggling_discards_the_session() {
        let mut s = Statistics::new(false);
        s.record_at(0);
        assert_eq!(s.snapshot_at(0).total, 0);
        s.set_enabled(true);
        s.record_at(0);
        s.set_enabled(true);
        assert_eq!(s.snapshot_at(0).total, 1);
        s.set_enabled(false);
        assert_eq!(s.snapshot_at(0).total, 0);
        s.set_enabled(true);
        assert_eq!(s.snapshot_at(0).per_minute, 0);
        assert_eq!(Statistics::new(true).snapshot_at(0).total, 0);
    }
    #[test]
    fn fixed_minute_includes_idle_and_does_not_inflate_startup_rate() {
        let mut s = Statistics::new(true);
        for _ in 0..10 {
            s.record_at(0);
        }
        s.record_at(59);
        assert_eq!(s.snapshot_at(59).per_minute, 11);
        assert_eq!(s.snapshot_at(60).per_minute, 1);
        assert_eq!(s.snapshot_at(119).per_minute, 0);
        assert_eq!(s.snapshot_at(119).total, 11);
    }
    #[test]
    fn bounded_aggregates_even_under_long_fast_sessions() {
        let mut s = Statistics::new(true);
        for second in 0..7200 {
            for _ in 0..50 {
                s.record_at(second);
            }
        }
        assert_eq!(s.buckets.len(), 60);
        assert_eq!(s.snapshot_at(7199).per_minute, 3000);
        let json = serde_json::to_value(s.snapshot_at(7200)).unwrap();
        assert_eq!(json.as_object().unwrap().len(), 2);
        assert_eq!(json["total"], 360000);
    }
}
