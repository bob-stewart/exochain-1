use exo_core::{hash_bytes, Blake3Hash};
use std::collections::HashMap;

/// Sparse Merkle Tree (Stub/Simple).
/// Used for State Root.
/// Key = Hash(Key), Value = Hash(Value).
/// Default value for empty leaf = Hash(0)? Or 0?
/// For MVP, we will use a naive implementation or a simple KV map hash aggregator if full SMT is too complex.
/// A simple "MapMerkle" that sorts keys and hashes is O(N) but deterministic.
#[derive(Default, Debug)]
pub struct Smt {
    pub leaves: HashMap<Blake3Hash, Blake3Hash>,
}

impl Smt {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn update(&mut self, key: Blake3Hash, value: Blake3Hash) {
        self.leaves.insert(key, value);
    }

    /// Compute root by sorting keys and building a tree.
    /// This is a "Merkle Trie" or "Patricia Trie" variant but simplified to a static tree for the batch.
    /// AKA "Merkle Map".
    pub fn get_root(&self) -> Blake3Hash {
        if self.leaves.is_empty() {
            return Blake3Hash([0u8; 32]);
        }

        // Sort keys for processing
        let mut sorted_keys: Vec<_> = self.leaves.keys().collect();
        sorted_keys.sort();

        // Build leaves
        let mut current_level: Vec<Blake3Hash> = sorted_keys
            .iter()
            .map(|k| {
                let v = self.leaves.get(k).unwrap();
                // Hash(k | v)
                let mut buf = Vec::with_capacity(64);
                buf.extend_from_slice(&k.0);
                buf.extend_from_slice(&v.0);
                hash_bytes(&buf)
            })
            .collect();

        // Merkleize up
        while current_level.len() > 1 {
            let mut next_level = Vec::new();
            for chunk in current_level.chunks(2) {
                if chunk.len() == 2 {
                    let mut buf = Vec::with_capacity(64);
                    buf.extend_from_slice(&chunk[0].0);
                    buf.extend_from_slice(&chunk[1].0);
                    next_level.push(hash_bytes(&buf));
                } else {
                    // Promote odd node
                    next_level.push(chunk[0]);
                }
            }
            current_level = next_level;
        }

        current_level[0]
    }
}
