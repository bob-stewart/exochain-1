use exo_core::Did;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum Effect {
    Allow,
    Deny,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Policy {
    pub id: String,
    pub description: String,
    pub effect: Effect,
    pub subjects: AccessorSet,
    pub resources: Vec<String>, // Resource IDs or wildcards
    pub conditions: Vec<Condition>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum AccessorSet {
    Any,
    Specific(Vec<Did>),
    Group(String), // Group ID
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Condition {
    pub type_: String, // e.g., "MFA", "RiskScore", "TimeOfDay"
    pub value: String, // e.g., "true", ">80", "AM"
}

impl Policy {
    pub fn is_match(&self, sub: &Did, res: &str) -> bool {
        // Simple matching logic
        let subject_match = match &self.subjects {
            AccessorSet::Any => true,
            AccessorSet::Specific(dids) => dids.contains(sub),
            AccessorSet::Group(_) => false, // TODO: Group resolution
        };

        if !subject_match {
            return false;
        }

        // Resource match (exact for now)
        if !self.resources.contains(&res.to_string()) && !self.resources.contains(&"*".to_string())
        {
            return false;
        }

        true
    }
}
