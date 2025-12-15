use crate::types::EventView;
use async_graphql::{Context, EmptySubscription, Object, Schema};

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    /// Fetch an event by ID (hex encoded).
    async fn event(&self, _ctx: &Context<'_>, _id: String) -> Option<EventView> {
        // In a real app, we get the store from context data
        // let store = ctx.data::<Box<dyn DagStore>>().ok()?;
        // For MVP/Stub, return None or Mock
        None
    }

    /// Health check.
    async fn health(&self) -> String {
        "OK".to_string()
    }
}

pub struct MutationRoot;

#[Object]
impl MutationRoot {
    /// Submit a raw event (stub).
    async fn submit_event(&self, _raw_bytes: String) -> bool {
        true
    }
}

pub type ApiSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

pub fn create_schema() -> ApiSchema {
    Schema::build(QueryRoot, MutationRoot, EmptySubscription).finish()
}
