# Tag Management Specification

## ADDED Requirements

### Requirement: Tag Creation

The system SHALL allow users to create new tags with name, color, and optional icon.

#### Scenario: Create custom tag with minimal data
- **WHEN** user creates a tag with only name
- **THEN** system creates tag with default color (#6B7280) and is_predefined=false

#### Scenario: Create tag with full data
- **WHEN** user creates a tag with name, color, and icon
- **THEN** system creates tag with all provided fields

#### Scenario: Create tag with duplicate name
- **WHEN** user creates a tag with a name that already exists
- **THEN** system returns 409 Conflict error

### Requirement: Tag Retrieval

The system SHALL provide the ability to retrieve individual tag details and list all tags.

#### Scenario: Get tag by ID
- **WHEN** user requests a tag by valid UUID
- **THEN** system returns the tag with all fields

#### Scenario: List all tags
- **WHEN** user requests tag list
- **THEN** system returns all tags ordered by name ascending

#### Scenario: List predefined tags
- **WHEN** user requests tag list with predefined filter
- **THEN** system returns only tags where is_predefined=true

### Requirement: Tag Update

The system SHALL allow users to update tag name, color, and icon.

#### Scenario: Update tag color
- **WHEN** user submits updated color for existing tag
- **THEN** system updates the color field

#### Scenario: Update tag icon
- **WHEN** user submits updated icon for existing tag
- **THEN** system updates the icon field

#### Scenario: Update tag name
- **WHEN** user submits updated name for existing tag
- **THEN** system updates the name field if not duplicate

#### Scenario: Update tag name to duplicate
- **WHEN** user submits a name that already exists for another tag
- **THEN** system returns 409 Conflict error

### Requirement: Tag Deletion

The system SHALL allow users to delete non-predefined tags.

#### Scenario: Delete custom tag
- **WHEN** user deletes a tag where is_predefined=false
- **THEN** system removes the tag and all ticket associations

#### Scenario: Delete predefined tag
- **WHEN** user attempts to delete a tag where is_predefined=true
- **THEN** system returns 403 Forbidden error

#### Scenario: Delete tag in use
- **WHEN** user deletes a tag that is associated with tickets
- **THEN** system removes the tag and cascades deletion to ticket_tags associations

### Requirement: Predefined Tags

The system SHALL support predefined tags that cannot be deleted by users.

#### Scenario: Seed predefined tags
- **WHEN** system initializes database
- **THEN** predefined tags are created with is_predefined=true

#### Scenario: Modify predefined tag appearance
- **WHEN** user updates color or icon of predefined tag
- **THEN** system allows the modification

### Requirement: Tag Data Model

The system SHALL store tags with the following fields: id (UUID), name (unique), color (HEX), icon (optional), is_predefined, created_at.

#### Scenario: Tag field constraints
- **WHEN** tag is created or updated
- **THEN** name must not be empty, name must be unique, color must be valid HEX format (#RRGGBB)

