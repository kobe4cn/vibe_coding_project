# A2UI Frontend Client Specification (React + A2UI Hybrid)

## ADDED Requirements

### Requirement: React + A2UI Hybrid Architecture
The system SHALL provide a hybrid frontend architecture with React as the main framework and A2UI Surface embedded as Web Components.

#### Scenario: React main framework
- **WHEN** the application loads
- **THEN** React SHALL be the main framework managing routing, state, and layout
- **AND** A2UI Surface components SHALL be embedded in specific content areas

#### Scenario: Page architecture decision
- **WHEN** implementing pages
- **THEN** TicketsPage, TicketCreatePage, TagsPage SHALL be pure A2UI surfaces
- **AND** TicketDetailPage, TicketEditPage SHALL be hybrid (A2UI content + React sidebar)

### Requirement: A2UISurface React Component
The system SHALL provide a React component that wraps A2UI Web Component for embedding in React pages.

#### Scenario: Mount A2UI surface
- **WHEN** A2UISurface component mounts
- **THEN** it SHALL create an a2ui-surface custom element using useRef
- **AND** establish SSE connection for the specified path

#### Scenario: Expose action handler
- **WHEN** A2UI surface needs to handle user actions
- **THEN** the component SHALL expose setActionHandler for parent components to intercept actions

#### Scenario: Expose dataModel access
- **WHEN** React components need to access A2UI data
- **THEN** the component SHALL expose dataModel for reading and writing values

### Requirement: useA2UI Hook
The client SHALL provide a React Hook for managing A2UI SSE connections.

#### Scenario: Connect to Rust backend
- **WHEN** establishing SSE connection
- **THEN** the hook SHALL connect to `/api/a2ui/stream` on port 3000

#### Scenario: Handle reconnection
- **WHEN** SSE connection fails or closes unexpectedly
- **THEN** the hook SHALL attempt reconnection after 3 seconds

#### Scenario: Parse and dispatch messages
- **WHEN** receiving SSE messages
- **THEN** the hook SHALL parse JSONL and dispatch to appropriate handlers

### Requirement: A2UIContext State Bridge
The client SHALL provide a React Context for bridging state between React and A2UI.

#### Scenario: Read from A2UI DataModel
- **WHEN** React component calls getValue(path)
- **THEN** the context SHALL return the value from A2UI DataModel

#### Scenario: Write to A2UI DataModel
- **WHEN** React component calls setValue(path, value)
- **THEN** the context SHALL update the A2UI DataModel

#### Scenario: Subscribe to changes
- **WHEN** React component calls subscribe(path, callback)
- **THEN** the context SHALL notify the callback when the path value changes

#### Scenario: Sync to React state
- **WHEN** React component calls syncToReact(path)
- **THEN** the context SHALL return a React-managed value that updates with DataModel

#### Scenario: Trigger A2UI action
- **WHEN** React component calls triggerAction(action)
- **THEN** the context SHALL POST the action to /api/a2ui/action

### Requirement: Lit Renderer Migration
The client SHALL migrate existing A2UI Lit renderer code with React integration support.

#### Scenario: DataModel React events
- **WHEN** DataModel value changes
- **THEN** it SHALL emit events that React components can subscribe to

#### Scenario: Component rendering
- **WHEN** rendering A2UI components
- **THEN** it SHALL use the same Lit-based rendering as existing a2ui_frontend/client

### Requirement: React Component Reuse
The system SHALL reuse existing React components from frontend/ with minimal modifications.

#### Scenario: TagSelector integration
- **WHEN** using TagSelector in hybrid pages
- **THEN** it SHALL work with A2UIContext for state synchronization

#### Scenario: AttachmentUploader component
- **WHEN** handling file uploads in hybrid pages
- **THEN** a new AttachmentUploader component SHALL use existing useUploadAttachment hook

#### Scenario: Toast notifications
- **WHEN** showing notifications
- **THEN** the existing Toast component and ToastContext SHALL be reused

#### Scenario: AppLayout integration
- **WHEN** rendering the application layout
- **THEN** AppLayout SHALL integrate A2UIProvider for state bridging

### Requirement: Hybrid Page Implementation
Mixed pages SHALL combine A2UI surfaces with React components.

#### Scenario: TicketDetailPage hybrid
- **WHEN** rendering TicketDetailPage
- **THEN** main content area SHALL use A2UI Surface
- **AND** sidebar SHALL use StatusTransitionPanel React component

#### Scenario: TicketEditPage hybrid
- **WHEN** rendering TicketEditPage
- **THEN** form main area SHALL use A2UI Surface
- **AND** sidebar SHALL use TagSelector and AttachmentUploader React components

#### Scenario: Data coordination
- **WHEN** React sidebar components need form data
- **THEN** they SHALL use A2UIContext to read from A2UI DataModel

### Requirement: MotherDuck Style Theme
The client SHALL apply MotherDuck design system styles.

#### Scenario: Apply color palette
- **WHEN** rendering UI components
- **THEN** the client SHALL use MotherDuck colors: primary yellow `#FFD93D`, deep blue `#1E3A5F`, sky blue `#D5E8F0`

#### Scenario: Apply typography
- **WHEN** rendering text content
- **THEN** the client SHALL use Inter font for body text and JetBrains Mono for code

#### Scenario: Apply 8px grid spacing
- **WHEN** rendering layout components
- **THEN** the client SHALL follow 8px grid spacing system

### Requirement: Project Structure
The client codebase SHALL be organized in the `a2ui_front/` directory.

#### Scenario: A2UI integration layer
- **WHEN** examining src/a2ui/
- **THEN** it SHALL contain A2UISurface.tsx, useA2UI.ts, A2UIContext.tsx, types.ts, and renderer/

#### Scenario: React components
- **WHEN** examining src/components/
- **THEN** it SHALL contain reused and new React components organized by feature

#### Scenario: API and hooks reuse
- **WHEN** examining src/api/ and src/hooks/
- **THEN** they SHALL contain code copied from frontend/ with minimal modifications

### Requirement: Vite Development Configuration
The client SHALL use Vite for development and build.

#### Scenario: Proxy configuration
- **WHEN** running in development mode
- **THEN** Vite SHALL proxy `/api` requests to `http://localhost:3000` (Rust backend)

#### Scenario: React and Lit support
- **WHEN** building the application
- **THEN** Vite SHALL support both React components and Lit custom elements
