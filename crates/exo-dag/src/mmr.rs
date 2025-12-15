use exo_core::{hash_bytes, Blake3Hash};
use serde::{Deserialize, Serialize};

/// Lightweight MMR Accumulator.
/// Maintains only the peaks of perfect subtrees to verify the root.
#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub struct Mmr {
    pub size: u64,
    // peaks[i] is Some(hash) if the i-th bit of size is 1.
    pub peaks: Vec<Option<Blake3Hash>>,
}

impl Mmr {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn append(&mut self, leaf: Blake3Hash) {
        let mut current = leaf;
        let mut h = 0;

        // While we have a peak at height `h`, merge and go up.
        loop {
            if h >= self.peaks.len() {
                self.peaks.push(None); // Grow
            }

            match self.peaks[h] {
                Some(left_sibling) => {
                    // Merge: H(Left | Right)
                    let mut buf = Vec::with_capacity(64);
                    buf.extend_from_slice(&left_sibling.0);
                    buf.extend_from_slice(&current.0);
                    current = hash_bytes(&buf);

                    // Clear the slot at this height (it moved up)
                    self.peaks[h] = None;
                    h += 1;
                }
                None => {
                    // Found an empty slot, park here.
                    self.peaks[h] = Some(current);
                    break;
                }
            }
        }
        self.size += 1;
    }

    pub fn get_root(&self) -> Blake3Hash {
        if self.size == 0 {
            return Blake3Hash([0u8; 32]);
        }

        let active_peaks: Vec<Blake3Hash> = self.peaks.iter().filter_map(|p| *p).collect();

        if active_peaks.is_empty() {
            return Blake3Hash([0u8; 32]);
        }

        // Bag from right-to-left (reverse of height order)
        let mut rev_iter = active_peaks.iter().rev();
        let mut root = *rev_iter.next().unwrap();

        for peak in rev_iter {
            // H(Peak | Root)
            let mut buf = Vec::with_capacity(64);
            buf.extend_from_slice(&peak.0);
            buf.extend_from_slice(&root.0);
            root = hash_bytes(&buf);
        }

        root
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use exo_core::hash_bytes;

    #[test]
    fn test_mmr_accumulation() {
        let mut mmr = Mmr::new();
        let leaves: Vec<Blake3Hash> = (0..5)
            .map(|i| {
                let mut buf = [0u8; 32];
                buf[0] = i;
                hash_bytes(&buf)
            })
            .collect();

        for leaf in &leaves {
            mmr.append(*leaf);
        }

        // Size should be 5
        assert_eq!(mmr.size, 5);

        // Verify peaks structure for size 5 (101 binary)
        // peaks[0] should be Some (1 leaf)
        // peaks[1] should be None
        // peaks[2] should be Some (4 leaves)
        assert!(mmr.peaks[0].is_some());
        assert!(mmr.peaks[1].is_none());
        assert!(mmr.peaks[2].is_some());

        // Root logic check
        let root = mmr.get_root();
        assert_ne!(root.0, [0u8; 32]);
    }
}
