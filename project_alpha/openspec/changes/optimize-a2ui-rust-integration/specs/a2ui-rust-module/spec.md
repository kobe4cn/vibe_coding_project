# A2UI Rust Module Specification

## ADDED Requirements

### Requirement: A2UI Message Builder
The system SHALL provide an A2UI message builder module in Rust that generates JSONL-formatted messages conforming to A2UI v0.8 protocol.

#### Scenario: Build surfaceUpdate message
- **WHEN** the builder creates a surface update with components
- **THEN** the output SHALL be valid JSONL with structure `{"surfaceUpdate": {"surfaceId": string, "components": array}}`
- **AND** each component SHALL have `id` and `component` properties

#### Scenario: Build dataModelUpdate message
- **WHEN** the builder creates a data model update with path and contents
- **THEN** the output SHALL be valid JSONL with structure `{"dataModelUpdate": {"surfaceId": string, "path": string, "contents": array}}`
- **AND** contents SHALL support valueString, valueNumber, valueBoolean, and nested valueMap

#### Scenario: Build beginRendering message
- **WHEN** the builder creates a begin rendering message with root component ID
- **THEN** the output SHALL be valid JSONL with structure `{"beginRendering": {"surfaceId": string, "root": string}}`

### Requirement: Component Builder API
The builder SHALL support creating all A2UI v0.8 component types through a fluent API.

#### Scenario: Create text component
- **WHEN** calling `builder.text(id, text, usage_hint)`
- **THEN** a Text component SHALL be added with optional usageHint (h1-h4)

#### Scenario: Create button component
- **WHEN** calling `builder.button(id, child_id, action)`
- **THEN** a Button component SHALL be added with child reference and action definition

#### Scenario: Create text field component
- **WHEN** calling `builder.text_field(id, label, text, field_type)`
- **THEN** a TextField component SHALL be added supporting text and textarea types

#### Scenario: Create layout components
- **WHEN** calling `builder.column(id, children)` or `builder.row(id, children)`
- **THEN** a Column or Row component SHALL be added with alignment and distribution options

#### Scenario: Create list component with template
- **WHEN** calling `builder.list(id, template)` with template mode
- **THEN** a List component SHALL be added with template componentId and dataBinding path

#### Scenario: Create modal component
- **WHEN** calling `builder.modal(id, entry_point_child, content_child)`
- **THEN** a Modal component SHALL be added with entry point and content references

### Requirement: Value Type Helpers
The builder SHALL provide helper functions for creating A2UI value types.

#### Scenario: Create literal values
- **WHEN** calling `literal_string`, `literal_number`, or `literal_bool`
- **THEN** the appropriate BoundValue type SHALL be returned

#### Scenario: Create path reference
- **WHEN** calling `path(value)`
- **THEN** a path-type BoundValue SHALL be returned for data binding

#### Scenario: Create value map
- **WHEN** calling `value_map_from_dict` with a Rust HashMap
- **THEN** a properly structured ValueMap array SHALL be returned

### Requirement: SSE Stream Endpoint
The system SHALL provide an SSE endpoint for streaming A2UI messages to clients.

#### Scenario: Stream page messages
- **WHEN** client connects to `GET /api/a2ui/stream?path=/tickets`
- **THEN** the server SHALL stream JSONL messages for the requested page
- **AND** messages SHALL be sent in order: surfaceUpdate, dataModelUpdate(s), beginRendering

#### Scenario: Handle query parameters
- **WHEN** client connects with query parameters (e.g., `?path=/tickets&page=2&status=open`)
- **THEN** the server SHALL parse and apply all query parameters to data generation

#### Scenario: Keep-alive heartbeat
- **WHEN** SSE connection is idle
- **THEN** the server SHALL send keep-alive pings at 15-second intervals

### Requirement: UserAction Handler
The system SHALL provide an endpoint for processing user interaction events.

#### Scenario: Handle navigate action
- **WHEN** client POSTs a userAction with name "navigate"
- **THEN** the server SHALL return `{"navigate": "/path"}`

#### Scenario: Handle CRUD actions
- **WHEN** client POSTs a userAction for create/update/delete operations
- **THEN** the server SHALL call the appropriate REST API handler
- **AND** return navigation or refresh instruction on success

#### Scenario: Handle client-side actions
- **WHEN** client POSTs a userAction that only affects UI state
- **THEN** the server SHALL return `{"handled": true}`
- **AND** the client SHALL update local state without navigation

### Requirement: Page Builders
The system SHALL provide page builder functions for all application pages.

#### Scenario: Build tickets list page
- **WHEN** building the tickets list page
- **THEN** the builder SHALL generate search box, status filter, priority filter, ticket list, and pagination components

#### Scenario: Build ticket detail page
- **WHEN** building the ticket detail page
- **THEN** the builder SHALL generate title, description, priority selection, tag selection, status transition, attachments, and history components

#### Scenario: Build ticket create/edit pages
- **WHEN** building ticket create or edit pages
- **THEN** the builder SHALL generate form fields for title, description, priority, and tags

#### Scenario: Build tags management page
- **WHEN** building the tags management page
- **THEN** the builder SHALL generate create form, predefined tags list, and custom tags list components

#### Scenario: Build app layout
- **WHEN** building any page
- **THEN** the builder SHALL wrap content in app layout with navigation header
