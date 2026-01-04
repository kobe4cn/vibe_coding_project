//! A2UI v0.8 Protocol Implementation
//!
//! Server-Driven UI module for generating JSONL messages
//! that the frontend A2UI renderer can consume via SSE.

pub mod builder;
pub mod sse;
pub mod types;

pub use builder::*;
pub use sse::*;
pub use types::*;

#[cfg(test)]
mod tests {
    use super::*;

    /// Generate TypeScript type definitions
    /// Run with: cargo test export_bindings -- --nocapture
    #[test]
    fn export_bindings() {
        use ts_rs::TS;
        use std::path::Path;
        use std::fs;

        let output_dir = Path::new("../a2ui_front/src/a2ui/generated");

        // Create output directory if it doesn't exist
        fs::create_dir_all(output_dir).expect("Failed to create output directory");

        // Export all types
        BoundValue::export_all_to(output_dir).expect("Failed to export BoundValue");
        ValueMap::export_all_to(output_dir).expect("Failed to export ValueMap");
        Component::export_all_to(output_dir).expect("Failed to export Component");
        Children::export_all_to(output_dir).expect("Failed to export Children");
        TemplateBinding::export_all_to(output_dir).expect("Failed to export TemplateBinding");
        Action::export_all_to(output_dir).expect("Failed to export Action");
        ActionContext::export_all_to(output_dir).expect("Failed to export ActionContext");
        A2UIMessage::export_all_to(output_dir).expect("Failed to export A2UIMessage");
        SurfaceUpdatePayload::export_all_to(output_dir).expect("Failed to export SurfaceUpdatePayload");
        DataModelUpdatePayload::export_all_to(output_dir).expect("Failed to export DataModelUpdatePayload");
        BeginRenderingPayload::export_all_to(output_dir).expect("Failed to export BeginRenderingPayload");
        DeleteSurfacePayload::export_all_to(output_dir).expect("Failed to export DeleteSurfacePayload");
        UserAction::export_all_to(output_dir).expect("Failed to export UserAction");

        println!("TypeScript types exported to: {:?}", output_dir);
    }
}
