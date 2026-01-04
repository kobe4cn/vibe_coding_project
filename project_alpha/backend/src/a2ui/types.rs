//! A2UI v0.8 Protocol Types
//!
//! Type definitions for the A2UI protocol messages.
//!
//! These types are exported to TypeScript using ts-rs.
//! Run `cargo test export_bindings` to generate TypeScript definitions.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_rs::TS;

// ============================================================================
// Value Types
// ============================================================================

/// A bound value that can be a literal or a data binding path
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "a2ui_types/")]
#[serde(untagged)]
pub enum BoundValue {
    LiteralString {
        #[serde(rename = "literalString")]
        literal_string: String,
    },
    LiteralNumber {
        #[serde(rename = "literalNumber")]
        literal_number: f64,
    },
    LiteralBoolean {
        #[serde(rename = "literalBoolean")]
        literal_boolean: bool,
    },
    Path {
        path: String,
    },
}

#[allow(dead_code)]
impl BoundValue {
    pub fn string(s: impl Into<String>) -> Self {
        BoundValue::LiteralString {
            literal_string: s.into(),
        }
    }

    pub fn number(n: f64) -> Self {
        BoundValue::LiteralNumber { literal_number: n }
    }

    pub fn boolean(b: bool) -> Self {
        BoundValue::LiteralBoolean { literal_boolean: b }
    }

    pub fn path(p: impl Into<String>) -> Self {
        BoundValue::Path { path: p.into() }
    }
}

// ============================================================================
// Data Model Types
// ============================================================================

/// A value in the data model
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "a2ui_types/")]
pub struct ValueMap {
    pub key: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "valueString")]
    #[ts(rename = "valueString")]
    pub value_string: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "valueNumber")]
    #[ts(rename = "valueNumber")]
    pub value_number: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "valueBoolean")]
    #[ts(rename = "valueBoolean")]
    pub value_boolean: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "valueMap")]
    #[ts(rename = "valueMap")]
    pub value_map: Option<Vec<ValueMap>>,
}

#[allow(dead_code)]
impl ValueMap {
    pub fn string(key: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            value_string: Some(value.into()),
            value_number: None,
            value_boolean: None,
            value_map: None,
        }
    }

    pub fn number(key: impl Into<String>, value: f64) -> Self {
        Self {
            key: key.into(),
            value_string: None,
            value_number: Some(value),
            value_boolean: None,
            value_map: None,
        }
    }

    pub fn boolean(key: impl Into<String>, value: bool) -> Self {
        Self {
            key: key.into(),
            value_string: None,
            value_number: None,
            value_boolean: Some(value),
            value_map: None,
        }
    }

    pub fn map(key: impl Into<String>, values: Vec<ValueMap>) -> Self {
        Self {
            key: key.into(),
            value_string: None,
            value_number: None,
            value_boolean: None,
            value_map: Some(values),
        }
    }
}

// ============================================================================
// Component Types
// ============================================================================

/// A UI component definition
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "a2ui_types/")]
pub struct Component {
    pub id: String,
    #[ts(type = "Record<string, unknown>")]
    pub component: HashMap<String, serde_json::Value>,
}

/// Children definition for container components
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "a2ui_types/")]
#[serde(untagged)]
pub enum Children {
    Explicit {
        #[serde(rename = "explicitList")]
        explicit_list: Vec<String>,
    },
    Template {
        template: TemplateBinding,
    },
}

impl Children {
    pub fn explicit(ids: Vec<impl Into<String>>) -> Self {
        Children::Explicit {
            explicit_list: ids.into_iter().map(|s| s.into()).collect(),
        }
    }

    pub fn template(component_id: impl Into<String>, data_binding: impl Into<String>) -> Self {
        Children::Template {
            template: TemplateBinding {
                component_id: component_id.into(),
                data_binding: data_binding.into(),
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "a2ui_types/")]
pub struct TemplateBinding {
    #[serde(rename = "componentId")]
    #[ts(rename = "componentId")]
    pub component_id: String,
    #[serde(rename = "dataBinding")]
    #[ts(rename = "dataBinding")]
    pub data_binding: String,
}

// ============================================================================
// Action Types
// ============================================================================

/// An action that can be triggered by user interaction
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "a2ui_types/")]
pub struct Action {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<Vec<ActionContext>>,
}

impl Action {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            context: None,
        }
    }

    pub fn with_context(mut self, key: impl Into<String>, value: BoundValue) -> Self {
        let ctx = ActionContext {
            key: key.into(),
            value,
        };
        self.context.get_or_insert_with(Vec::new).push(ctx);
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "a2ui_types/")]
pub struct ActionContext {
    pub key: String,
    pub value: BoundValue,
}

// ============================================================================
// Message Types
// ============================================================================

/// A2UI protocol message
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "a2ui_types/")]
#[serde(untagged)]
pub enum A2UIMessage {
    SurfaceUpdate {
        #[serde(rename = "surfaceUpdate")]
        surface_update: SurfaceUpdatePayload,
    },
    DataModelUpdate {
        #[serde(rename = "dataModelUpdate")]
        data_model_update: DataModelUpdatePayload,
    },
    BeginRendering {
        #[serde(rename = "beginRendering")]
        begin_rendering: BeginRenderingPayload,
    },
    DeleteSurface {
        #[serde(rename = "deleteSurface")]
        delete_surface: DeleteSurfacePayload,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "a2ui_types/")]
pub struct SurfaceUpdatePayload {
    #[serde(rename = "surfaceId")]
    #[ts(rename = "surfaceId")]
    pub surface_id: String,
    pub components: Vec<Component>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "a2ui_types/")]
pub struct DataModelUpdatePayload {
    #[serde(rename = "surfaceId")]
    #[ts(rename = "surfaceId")]
    pub surface_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    pub contents: Vec<ValueMap>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "a2ui_types/")]
pub struct BeginRenderingPayload {
    #[serde(rename = "surfaceId")]
    #[ts(rename = "surfaceId")]
    pub surface_id: String,
    pub root: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "a2ui_types/")]
pub struct DeleteSurfacePayload {
    #[serde(rename = "surfaceId")]
    #[ts(rename = "surfaceId")]
    pub surface_id: String,
}

// ============================================================================
// User Action Types
// ============================================================================

/// A user action sent from the client
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "a2ui_types/")]
pub struct UserAction {
    pub name: String,
    #[serde(rename = "surfaceId")]
    #[ts(rename = "surfaceId")]
    pub surface_id: String,
    #[serde(rename = "sourceComponentId")]
    #[ts(rename = "sourceComponentId")]
    pub source_component_id: String,
    pub timestamp: String,
    #[ts(type = "Record<string, unknown>")]
    pub context: HashMap<String, serde_json::Value>,
}
