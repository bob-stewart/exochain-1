use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

/// Hybrid Logical Clock for causality ordering.
/// See Spec Section 9.2 for HLC rules.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Copy)]
pub struct HybridLogicalClock {
    /// Physical timestamp in milliseconds (wall clock).
    pub physical_ms: u64,

    /// Logical counter for events at same physical time.
    pub logical: u32,
}

impl PartialOrd for HybridLogicalClock {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for HybridLogicalClock {
    fn cmp(&self, other: &Self) -> Ordering {
        match self.physical_ms.cmp(&other.physical_ms) {
            Ordering::Equal => self.logical.cmp(&other.logical),
            other => other,
        }
    }
}

impl HybridLogicalClock {
    /// Create new HLC definition based on Spec 9.2.
    pub fn new_event(node_time: u64, parent_times: &[HybridLogicalClock]) -> Self {
        let max_parent_physical = parent_times
            .iter()
            .map(|h| h.physical_ms)
            .max()
            .unwrap_or(0);

        let physical_ms = node_time.max(max_parent_physical);

        let logical = if physical_ms == max_parent_physical {
            let max_logical = parent_times
                .iter()
                .filter(|h| h.physical_ms == physical_ms)
                .map(|h| h.logical)
                .max()
                .unwrap_or(0);
            max_logical + 1
        } else {
            0
        };

        Self {
            physical_ms,
            logical,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hlc_ordering() {
        let t1 = HybridLogicalClock {
            physical_ms: 100,
            logical: 0,
        };
        let t2 = HybridLogicalClock {
            physical_ms: 100,
            logical: 1,
        };
        let t3 = HybridLogicalClock {
            physical_ms: 101,
            logical: 0,
        };

        assert!(t1 < t2);
        assert!(t2 < t3);
        assert!(t1 < t3);
    }

    #[test]
    fn test_new_event_logical_increment() {
        let parent = HybridLogicalClock {
            physical_ms: 100,
            logical: 5,
        };
        // Node time is same as parent
        let next = HybridLogicalClock::new_event(100, &[parent]);
        assert_eq!(next.physical_ms, 100);
        assert_eq!(next.logical, 6);
    }

    #[test]
    fn test_new_event_physical_advance() {
        let parent = HybridLogicalClock {
            physical_ms: 100,
            logical: 5,
        };
        // Node time is ahead
        let next = HybridLogicalClock::new_event(200, &[parent]);
        assert_eq!(next.physical_ms, 200);
        assert_eq!(next.logical, 0);
    }

    #[test]
    fn test_new_event_catchup() {
        let parent = HybridLogicalClock {
            physical_ms: 200,
            logical: 5,
        };
        // Node time is behind (clock skew or fast parent)
        let next = HybridLogicalClock::new_event(100, &[parent]);
        assert_eq!(next.physical_ms, 200);
        assert_eq!(next.logical, 6);
    }
}
