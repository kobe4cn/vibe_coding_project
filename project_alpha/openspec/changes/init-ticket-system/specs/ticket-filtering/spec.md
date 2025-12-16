# Ticket Filtering Specification

## ADDED Requirements

### Requirement: Search by Title

The system SHALL allow users to search tickets by title using partial text matching.

#### Scenario: Search with matching results
- **WHEN** user searches with a term that matches ticket titles
- **THEN** system returns all tickets where title contains the search term (case-insensitive)

#### Scenario: Search with no results
- **WHEN** user searches with a term that matches no ticket titles
- **THEN** system returns empty list

#### Scenario: Search with empty term
- **WHEN** user searches with empty or whitespace-only term
- **THEN** system returns all tickets (no filter applied)

### Requirement: Filter by Tags

The system SHALL allow users to filter tickets by one or more tags.

#### Scenario: Filter by single tag
- **WHEN** user filters by one tag_id
- **THEN** system returns only tickets associated with that tag

#### Scenario: Filter by multiple tags (AND logic)
- **WHEN** user filters by multiple tag_ids
- **THEN** system returns tickets that have ALL specified tags

#### Scenario: Filter by non-existent tag
- **WHEN** user filters by a tag_id that does not exist
- **THEN** system returns empty list

### Requirement: Filter by Status

The system SHALL allow users to filter tickets by status.

#### Scenario: Filter by open status
- **WHEN** user filters by status=open
- **THEN** system returns only tickets with status "open"

#### Scenario: Filter by completed status
- **WHEN** user filters by status=completed
- **THEN** system returns only tickets with status "completed"

#### Scenario: Filter by multiple statuses
- **WHEN** user filters by multiple status values
- **THEN** system returns tickets matching any of the specified statuses (OR logic)

### Requirement: Filter by Priority

The system SHALL allow users to filter tickets by priority.

#### Scenario: Filter by single priority
- **WHEN** user filters by priority=high
- **THEN** system returns only tickets with priority "high"

#### Scenario: Filter by multiple priorities
- **WHEN** user filters by multiple priority values
- **THEN** system returns tickets matching any of the specified priorities (OR logic)

### Requirement: Combined Filtering

The system SHALL support combining search, tag filters, status filters, and priority filters.

#### Scenario: Search and filter by tag
- **WHEN** user provides both search term and tag filter
- **THEN** system returns tickets matching both criteria (AND logic)

#### Scenario: Search and filter by status
- **WHEN** user provides both search term and status filter
- **THEN** system returns tickets matching both criteria (AND logic)

#### Scenario: All filters combined
- **WHEN** user provides search term, tag filter, status filter, and priority filter
- **THEN** system returns tickets matching all criteria (AND logic)

### Requirement: Pagination

The system SHALL support pagination for ticket list results.

#### Scenario: Default pagination
- **WHEN** user requests ticket list without pagination parameters
- **THEN** system returns first page with default page size (e.g., 20 items)

#### Scenario: Custom page size
- **WHEN** user requests ticket list with per_page parameter
- **THEN** system returns specified number of items per page

#### Scenario: Navigate to specific page
- **WHEN** user requests ticket list with page parameter
- **THEN** system returns the specified page of results

#### Scenario: Page beyond available data
- **WHEN** user requests a page number exceeding available pages
- **THEN** system returns empty list with correct total count metadata

### Requirement: Sorting

The system SHALL support sorting ticket list results.

#### Scenario: Default sorting
- **WHEN** user requests ticket list without sort parameters
- **THEN** system returns tickets ordered by created_at descending (newest first)

#### Scenario: Sort by updated_at
- **WHEN** user requests ticket list sorted by updated_at
- **THEN** system returns tickets ordered by updated_at in specified direction

#### Scenario: Sort by title
- **WHEN** user requests ticket list sorted by title
- **THEN** system returns tickets ordered alphabetically by title

#### Scenario: Sort by priority
- **WHEN** user requests ticket list sorted by priority
- **THEN** system returns tickets ordered by priority level (urgent > high > medium > low)

