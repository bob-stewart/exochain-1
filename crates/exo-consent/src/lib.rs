//! exo-consent: Bailment, Policies, and Gatekeeper interfaces.

pub mod bailment;
pub mod gatekeeper;
pub mod policy;

pub fn hello() -> String {
    "Hello from exo-consent".to_string()
}
