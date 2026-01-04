//! A2UI Component Builder
//!
//! Fluent API for building A2UI components and messages.

use serde_json::json;
use std::collections::HashMap;

use super::types::*;

/// Builder for creating A2UI components
#[allow(dead_code)]
pub struct ComponentBuilder {
    components: Vec<Component>,
    id_counter: u32,
}

#[allow(dead_code)]
impl ComponentBuilder {
    pub fn new() -> Self {
        Self {
            components: Vec::new(),
            id_counter: 0,
        }
    }

    fn next_id(&mut self, prefix: &str) -> String {
        self.id_counter += 1;
        format!("{}-{}", prefix, self.id_counter)
    }

    /// Add a pre-built component
    pub fn add(&mut self, component: Component) -> &mut Self {
        self.components.push(component);
        self
    }

    /// Build all components
    pub fn build(self) -> Vec<Component> {
        self.components
    }

    // ========================================================================
    // Text Components
    // ========================================================================

    pub fn text(&mut self, id: impl Into<String>, text: BoundValue) -> &mut Self {
        self.text_with_hint(id, text, None)
    }

    pub fn text_with_hint(
        &mut self,
        id: impl Into<String>,
        text: BoundValue,
        usage_hint: Option<&str>,
    ) -> &mut Self {
        self.text_with_options(id, text, usage_hint, None)
    }

    pub fn text_with_width(
        &mut self,
        id: impl Into<String>,
        text: BoundValue,
        width: &str,
    ) -> &mut Self {
        self.text_with_options(id, text, None, Some(width))
    }

    pub fn text_with_options(
        &mut self,
        id: impl Into<String>,
        text: BoundValue,
        usage_hint: Option<&str>,
        width: Option<&str>,
    ) -> &mut Self {
        let mut props = HashMap::new();
        props.insert("text".to_string(), serde_json::to_value(&text).unwrap());
        if let Some(hint) = usage_hint {
            props.insert("usageHint".to_string(), json!(hint));
        }
        if let Some(w) = width {
            props.insert("width".to_string(), json!(w));
        }

        self.components.push(Component {
            id: id.into(),
            component: [("Text".to_string(), json!(props))].into_iter().collect(),
        });
        self
    }

    pub fn h1(&mut self, id: impl Into<String>, text: impl Into<String>) -> &mut Self {
        self.text_with_hint(id, BoundValue::string(text), Some("h1"))
    }

    pub fn h2(&mut self, id: impl Into<String>, text: impl Into<String>) -> &mut Self {
        self.text_with_hint(id, BoundValue::string(text), Some("h2"))
    }

    pub fn h3(&mut self, id: impl Into<String>, text: impl Into<String>) -> &mut Self {
        self.text_with_hint(id, BoundValue::string(text), Some("h3"))
    }

    pub fn label(&mut self, id: impl Into<String>, text: impl Into<String>) -> &mut Self {
        self.text_with_hint(id, BoundValue::string(text), Some("label"))
    }

    // ========================================================================
    // Button Components
    // ========================================================================

    pub fn button(
        &mut self,
        id: impl Into<String>,
        child_id: impl Into<String>,
        action: Action,
    ) -> &mut Self {
        self.button_with_variant(id, child_id, action, None)
    }

    pub fn button_with_variant(
        &mut self,
        id: impl Into<String>,
        child_id: impl Into<String>,
        action: Action,
        variant: Option<&str>,
    ) -> &mut Self {
        let mut props: HashMap<String, serde_json::Value> = HashMap::new();
        props.insert("child".to_string(), json!(child_id.into()));
        props.insert("action".to_string(), serde_json::to_value(&action).unwrap());
        if let Some(v) = variant {
            props.insert("variant".to_string(), json!(v));
        }

        self.components.push(Component {
            id: id.into(),
            component: [("Button".to_string(), json!(props))].into_iter().collect(),
        });
        self
    }

    // ========================================================================
    // Input Components
    // ========================================================================

    pub fn text_field(
        &mut self,
        id: impl Into<String>,
        label: BoundValue,
        text: BoundValue,
    ) -> &mut Self {
        self.text_field_with_type(id, label, text, None)
    }

    pub fn text_field_with_type(
        &mut self,
        id: impl Into<String>,
        label: BoundValue,
        text: BoundValue,
        field_type: Option<&str>,
    ) -> &mut Self {
        let mut props = HashMap::new();
        props.insert("label".to_string(), serde_json::to_value(&label).unwrap());
        props.insert("text".to_string(), serde_json::to_value(&text).unwrap());
        if let Some(t) = field_type {
            props.insert("textFieldType".to_string(), json!(t));
        }

        self.components.push(Component {
            id: id.into(),
            component: [("TextField".to_string(), json!(props))]
                .into_iter()
                .collect(),
        });
        self
    }

    pub fn textarea(
        &mut self,
        id: impl Into<String>,
        label: BoundValue,
        text: BoundValue,
    ) -> &mut Self {
        self.text_field_with_type(id, label, text, Some("multiline"))
    }

    // ========================================================================
    // Container Components
    // ========================================================================

    pub fn column(&mut self, id: impl Into<String>, children: Children) -> &mut Self {
        self.column_with_props(id, children, None, None)
    }

    pub fn column_with_props(
        &mut self,
        id: impl Into<String>,
        children: Children,
        alignment: Option<&str>,
        distribution: Option<&str>,
    ) -> &mut Self {
        let mut props = HashMap::new();
        props.insert(
            "children".to_string(),
            serde_json::to_value(&children).unwrap(),
        );
        if let Some(a) = alignment {
            props.insert("alignment".to_string(), json!(a));
        }
        if let Some(d) = distribution {
            props.insert("distribution".to_string(), json!(d));
        }

        self.components.push(Component {
            id: id.into(),
            component: [("Column".to_string(), json!(props))].into_iter().collect(),
        });
        self
    }

    pub fn row(&mut self, id: impl Into<String>, children: Children) -> &mut Self {
        self.row_with_props(id, children, None, None)
    }

    pub fn row_with_props(
        &mut self,
        id: impl Into<String>,
        children: Children,
        alignment: Option<&str>,
        distribution: Option<&str>,
    ) -> &mut Self {
        let mut props = HashMap::new();
        props.insert(
            "children".to_string(),
            serde_json::to_value(&children).unwrap(),
        );
        if let Some(a) = alignment {
            props.insert("alignment".to_string(), json!(a));
        }
        if let Some(d) = distribution {
            props.insert("distribution".to_string(), json!(d));
        }

        self.components.push(Component {
            id: id.into(),
            component: [("Row".to_string(), json!(props))].into_iter().collect(),
        });
        self
    }

    pub fn card(&mut self, id: impl Into<String>, child_id: impl Into<String>) -> &mut Self {
        let props: HashMap<String, serde_json::Value> =
            [("child".to_string(), json!(child_id.into()))]
                .into_iter()
                .collect();

        self.components.push(Component {
            id: id.into(),
            component: [("Card".to_string(), json!(props))].into_iter().collect(),
        });
        self
    }

    pub fn list(&mut self, id: impl Into<String>, children: Children) -> &mut Self {
        self.list_with_direction(id, children, "vertical")
    }

    pub fn list_with_direction(
        &mut self,
        id: impl Into<String>,
        children: Children,
        direction: &str,
    ) -> &mut Self {
        let props: HashMap<String, serde_json::Value> = [
            (
                "children".to_string(),
                serde_json::to_value(&children).unwrap(),
            ),
            ("direction".to_string(), json!(direction)),
        ]
        .into_iter()
        .collect();

        self.components.push(Component {
            id: id.into(),
            component: [("List".to_string(), json!(props))].into_iter().collect(),
        });
        self
    }

    // ========================================================================
    // Other Components
    // ========================================================================

    pub fn divider(&mut self, id: impl Into<String>) -> &mut Self {
        self.components.push(Component {
            id: id.into(),
            component: [("Divider".to_string(), json!({}))].into_iter().collect(),
        });
        self
    }

    /// Color swatch - displays a colored square/circle
    pub fn color_swatch(&mut self, id: impl Into<String>, color: BoundValue) -> &mut Self {
        self.color_swatch_with_width(id, color, None)
    }

    pub fn color_swatch_with_width(
        &mut self,
        id: impl Into<String>,
        color: BoundValue,
        width: Option<&str>,
    ) -> &mut Self {
        let mut props = HashMap::new();
        props.insert("color".to_string(), serde_json::to_value(&color).unwrap());
        if let Some(w) = width {
            props.insert("width".to_string(), json!(w));
        }

        self.components.push(Component {
            id: id.into(),
            component: [("ColorSwatch".to_string(), json!(props))]
                .into_iter()
                .collect(),
        });
        self
    }

    pub fn icon(&mut self, id: impl Into<String>, name: BoundValue) -> &mut Self {
        let props: HashMap<String, serde_json::Value> =
            [("name".to_string(), serde_json::to_value(&name).unwrap())]
                .into_iter()
                .collect();

        self.components.push(Component {
            id: id.into(),
            component: [("Icon".to_string(), json!(props))].into_iter().collect(),
        });
        self
    }

    pub fn checkbox(
        &mut self,
        id: impl Into<String>,
        label: BoundValue,
        value: BoundValue,
    ) -> &mut Self {
        let props: HashMap<String, serde_json::Value> = [
            ("label".to_string(), serde_json::to_value(&label).unwrap()),
            ("value".to_string(), serde_json::to_value(&value).unwrap()),
        ]
        .into_iter()
        .collect();

        self.components.push(Component {
            id: id.into(),
            component: [("CheckBox".to_string(), json!(props))]
                .into_iter()
                .collect(),
        });
        self
    }
}

impl Default for ComponentBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Builder for creating A2UI messages
#[allow(dead_code)]
pub struct MessageBuilder {
    surface_id: String,
}

#[allow(dead_code)]
impl MessageBuilder {
    pub fn new(surface_id: impl Into<String>) -> Self {
        Self {
            surface_id: surface_id.into(),
        }
    }

    /// Create a surface update message
    pub fn surface_update(&self, components: Vec<Component>) -> A2UIMessage {
        A2UIMessage::SurfaceUpdate {
            surface_update: SurfaceUpdatePayload {
                surface_id: self.surface_id.clone(),
                components,
            },
        }
    }

    /// Create a data model update message
    pub fn data_update(&self, path: Option<String>, contents: Vec<ValueMap>) -> A2UIMessage {
        A2UIMessage::DataModelUpdate {
            data_model_update: DataModelUpdatePayload {
                surface_id: self.surface_id.clone(),
                path,
                contents,
            },
        }
    }

    /// Create a begin rendering message
    pub fn begin_rendering(&self, root_id: impl Into<String>) -> A2UIMessage {
        A2UIMessage::BeginRendering {
            begin_rendering: BeginRenderingPayload {
                surface_id: self.surface_id.clone(),
                root: root_id.into(),
            },
        }
    }

    /// Create a delete surface message
    pub fn delete_surface(&self) -> A2UIMessage {
        A2UIMessage::DeleteSurface {
            delete_surface: DeleteSurfacePayload {
                surface_id: self.surface_id.clone(),
            },
        }
    }
}
