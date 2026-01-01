"""A2UI v0.8 message builder utilities."""
import json
from typing import Any, Optional, Union


class A2UIBuilder:
    """Builder for A2UI v0.8 JSONL messages."""

    def __init__(self, surface_id: str = "main"):
        self.surface_id = surface_id
        self._components: list[dict] = []
        self._data_updates: list[dict] = []

    def reset(self):
        """Reset builder state."""
        self._components = []
        self._data_updates = []

    # Value helpers
    @staticmethod
    def literal_string(value: str) -> dict:
        return {"literalString": value}

    @staticmethod
    def literal_number(value: Union[int, float]) -> dict:
        return {"literalNumber": value}

    @staticmethod
    def literal_bool(value: bool) -> dict:
        return {"literalBoolean": value}

    @staticmethod
    def path(value: str) -> dict:
        return {"path": value}

    # Component builders
    def text(
        self,
        component_id: str,
        text: Union[str, dict],
        usage_hint: Optional[str] = None,
    ) -> "A2UIBuilder":
        """Add a Text component."""
        text_value = text if isinstance(text, dict) else self.literal_string(text)
        props: dict[str, Any] = {"text": text_value}
        if usage_hint:
            props["usageHint"] = usage_hint
        self._components.append({
            "id": component_id,
            "component": {"Text": props}
        })
        return self

    def button(
        self,
        component_id: str,
        child_id: str,
        action_name: str,
        context: Optional[list[dict]] = None,
    ) -> "A2UIBuilder":
        """Add a Button component."""
        action: dict[str, Any] = {"name": action_name}
        if context:
            action["context"] = context
        self._components.append({
            "id": component_id,
            "component": {"Button": {"child": child_id, "action": action}}
        })
        return self

    def text_field(
        self,
        component_id: str,
        label: Union[str, dict],
        text: Optional[Union[str, dict]] = None,
        text_field_type: Optional[str] = None,
    ) -> "A2UIBuilder":
        """Add a TextField component."""
        label_value = label if isinstance(label, dict) else self.literal_string(label)
        props: dict[str, Any] = {"label": label_value}
        if text:
            text_value = text if isinstance(text, dict) else self.literal_string(text)
            props["text"] = text_value
        if text_field_type:
            props["textFieldType"] = text_field_type
        self._components.append({
            "id": component_id,
            "component": {"TextField": props}
        })
        return self

    def column(
        self,
        component_id: str,
        children: list[str],
        alignment: Optional[str] = None,
        distribution: Optional[str] = None,
    ) -> "A2UIBuilder":
        """Add a Column component."""
        props: dict[str, Any] = {"children": {"explicitList": children}}
        if alignment:
            props["alignment"] = alignment
        if distribution:
            props["distribution"] = distribution
        self._components.append({
            "id": component_id,
            "component": {"Column": props}
        })
        return self

    def row(
        self,
        component_id: str,
        children: list[str],
        alignment: Optional[str] = None,
        distribution: Optional[str] = None,
    ) -> "A2UIBuilder":
        """Add a Row component."""
        props: dict[str, Any] = {"children": {"explicitList": children}}
        if alignment:
            props["alignment"] = alignment
        if distribution:
            props["distribution"] = distribution
        self._components.append({
            "id": component_id,
            "component": {"Row": props}
        })
        return self

    def card(
        self,
        component_id: str,
        child: str,
    ) -> "A2UIBuilder":
        """Add a Card component."""
        self._components.append({
            "id": component_id,
            "component": {"Card": {"child": child}}
        })
        return self

    def list_component(
        self,
        component_id: str,
        children: Optional[list[str]] = None,
        template: Optional[dict] = None,
        direction: str = "vertical",
        alignment: Optional[str] = None,
    ) -> "A2UIBuilder":
        """Add a List component."""
        props: dict[str, Any] = {"direction": direction}
        if children:
            props["children"] = {"explicitList": children}
        elif template:
            props["children"] = {"template": template}
        if alignment:
            props["alignment"] = alignment
        self._components.append({
            "id": component_id,
            "component": {"List": props}
        })
        return self

    def icon(
        self,
        component_id: str,
        name: Union[str, dict],
    ) -> "A2UIBuilder":
        """Add an Icon component."""
        name_value = name if isinstance(name, dict) else self.literal_string(name)
        self._components.append({
            "id": component_id,
            "component": {"Icon": {"name": name_value}}
        })
        return self

    def divider(self, component_id: str) -> "A2UIBuilder":
        """Add a Divider component."""
        self._components.append({
            "id": component_id,
            "component": {"Divider": {}}
        })
        return self

    def modal(
        self,
        component_id: str,
        entry_point_child: str,
        content_child: str,
    ) -> "A2UIBuilder":
        """Add a Modal component."""
        self._components.append({
            "id": component_id,
            "component": {"Modal": {
                "entryPointChild": entry_point_child,
                "contentChild": content_child,
            }}
        })
        return self

    def checkbox(
        self,
        component_id: str,
        label: Union[str, dict],
        value: Union[bool, dict],
    ) -> "A2UIBuilder":
        """Add a CheckBox component."""
        label_value = label if isinstance(label, dict) else self.literal_string(label)
        value_data = value if isinstance(value, dict) else self.literal_bool(value)
        self._components.append({
            "id": component_id,
            "component": {"CheckBox": {"label": label_value, "value": value_data}}
        })
        return self

    def slider(
        self,
        component_id: str,
        value: Union[int, float, dict],
        min_value: Optional[Union[int, float]] = None,
        max_value: Optional[Union[int, float]] = None,
    ) -> "A2UIBuilder":
        """Add a Slider component."""
        value_data = value if isinstance(value, dict) else self.literal_number(value)
        props: dict[str, Any] = {"value": value_data}
        if min_value is not None:
            props["minValue"] = min_value
        if max_value is not None:
            props["maxValue"] = max_value
        self._components.append({
            "id": component_id,
            "component": {"Slider": props}
        })
        return self

    def multi_select(
        self,
        component_id: str,
        label: Union[str, dict],
        options: list[dict],  # List of {id, name, color?} dicts
        selected_path: str,  # Path to comma-separated selected IDs
        action_name: str = "toggle_multi_select",
    ) -> "A2UIBuilder":
        """Add a MultiSelect dropdown component."""
        label_value = label if isinstance(label, dict) else self.literal_string(label)
        self._components.append({
            "id": component_id,
            "component": {"MultiSelect": {
                "label": label_value,
                "options": options,
                "selectedPath": selected_path,
                "actionName": action_name,
            }}
        })
        return self

    def add_component(self, component: dict) -> "A2UIBuilder":
        """Add a raw component dict."""
        self._components.append(component)
        return self

    def add_components(self, components: list[dict]) -> "A2UIBuilder":
        """Add multiple raw component dicts."""
        self._components.extend(components)
        return self

    # Message builders
    def build_surface_update(self) -> str:
        """Build surfaceUpdate JSONL message."""
        return json.dumps({
            "surfaceUpdate": {
                "surfaceId": self.surface_id,
                "components": self._components
            }
        })

    def build_data_model_update(
        self,
        path: str,
        contents: list[dict],
    ) -> str:
        """Build dataModelUpdate JSONL message."""
        return json.dumps({
            "dataModelUpdate": {
                "surfaceId": self.surface_id,
                "path": path,
                "contents": contents
            }
        })

    def build_begin_rendering(self, root: str) -> str:
        """Build beginRendering JSONL message."""
        return json.dumps({
            "beginRendering": {
                "surfaceId": self.surface_id,
                "root": root
            }
        })

    def build_delete_surface(self) -> str:
        """Build deleteSurface JSONL message."""
        return json.dumps({
            "deleteSurface": {
                "surfaceId": self.surface_id
            }
        })


# Data model helpers
def value_string(key: str, value: str) -> dict:
    return {"key": key, "valueString": value}


def value_number(key: str, value: Union[int, float]) -> dict:
    return {"key": key, "valueNumber": value}


def value_bool(key: str, value: bool) -> dict:
    return {"key": key, "valueBoolean": value}


def value_map(key: str, items: list[dict]) -> dict:
    return {"key": key, "valueMap": items}


def build_value_map_from_dict(data: dict) -> list[dict]:
    """Convert a Python dict to A2UI ValueMap contents."""
    contents = []
    for key, value in data.items():
        if isinstance(value, str):
            contents.append(value_string(key, value))
        elif isinstance(value, bool):
            contents.append(value_bool(key, value))
        elif isinstance(value, (int, float)):
            contents.append(value_number(key, value))
        elif isinstance(value, dict):
            contents.append(value_map(key, build_value_map_from_dict(value)))
        elif isinstance(value, list):
            # Convert list to map with index keys
            list_map = []
            for i, item in enumerate(value):
                if isinstance(item, dict):
                    list_map.append(value_map(f"item{i}", build_value_map_from_dict(item)))
                else:
                    list_map.append(value_string(f"item{i}", str(item)))
            contents.append(value_map(key, list_map))
        elif value is None:
            contents.append(value_string(key, ""))
    return contents
