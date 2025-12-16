# Ticket Management Specification

## ADDED Requirements

### Requirement: Ticket Creation

The system SHALL allow users to create new tickets with a title, optional description, and optional priority.

#### Scenario: Create ticket with minimal data
- **WHEN** user submits a ticket with only title
- **THEN** system creates ticket with status "open", priority "medium", and records created_at timestamp

#### Scenario: Create ticket with full data
- **WHEN** user submits a ticket with title, description, and priority
- **THEN** system creates ticket with all provided fields and status "open"

### Requirement: Ticket Retrieval

The system SHALL provide the ability to retrieve individual ticket details and list all tickets.

#### Scenario: Get ticket by ID
- **WHEN** user requests a ticket by valid UUID
- **THEN** system returns the ticket with all fields including associated tags

#### Scenario: Get non-existent ticket
- **WHEN** user requests a ticket by non-existent UUID
- **THEN** system returns 404 Not Found error

#### Scenario: List all tickets
- **WHEN** user requests ticket list without filters
- **THEN** system returns paginated list of all tickets ordered by created_at descending

### Requirement: Ticket Update

The system SHALL allow users to update ticket title, description, priority, and resolution.

#### Scenario: Update ticket title
- **WHEN** user submits updated title for existing ticket
- **THEN** system updates the title and updated_at timestamp

#### Scenario: Update ticket description
- **WHEN** user submits updated description for existing ticket
- **THEN** system updates the description and updated_at timestamp

#### Scenario: Update ticket priority
- **WHEN** user submits updated priority for existing ticket
- **THEN** system updates the priority and updated_at timestamp

#### Scenario: Update ticket resolution
- **WHEN** user submits resolution text for existing ticket
- **THEN** system updates the resolution field and updated_at timestamp

### Requirement: Ticket Deletion

The system SHALL allow users to delete tickets permanently.

#### Scenario: Delete existing ticket
- **WHEN** user requests deletion of existing ticket
- **THEN** system removes the ticket and all its tag associations

#### Scenario: Delete non-existent ticket
- **WHEN** user requests deletion of non-existent ticket
- **THEN** system returns 404 Not Found error

### Requirement: Ticket Status Definition

The system SHALL support four ticket statuses: open (待处理), in_progress (处理中), completed (已完成), and cancelled (已取消).

#### Scenario: Initial status
- **WHEN** ticket is created
- **THEN** status is set to "open"

#### Scenario: Status values
- **WHEN** status field is set
- **THEN** value must be one of: open, in_progress, completed, cancelled

### Requirement: Ticket Status Transitions

The system SHALL enforce valid status transitions according to the state machine rules.

#### Scenario: Start processing (open → in_progress)
- **WHEN** user changes status from "open" to "in_progress"
- **THEN** system updates status to "in_progress" and sets updated_at to current timestamp

#### Scenario: Complete ticket (in_progress → completed)
- **WHEN** user changes status from "in_progress" to "completed" with non-empty resolution text
- **THEN** system updates status to "completed", stores resolution, sets completed_at to current timestamp, and sets updated_at to current timestamp

#### Scenario: Complete ticket without resolution
- **WHEN** user attempts to change status to "completed" without providing resolution or with empty resolution
- **THEN** system returns 422 Unprocessable Entity error with message "Resolution is required when completing a ticket"

#### Scenario: Pause processing (in_progress → open)
- **WHEN** user changes status from "in_progress" to "open"
- **THEN** system updates status to "open" and sets updated_at to current timestamp

#### Scenario: Cancel from open (open → cancelled)
- **WHEN** user changes status from "open" to "cancelled"
- **THEN** system updates status to "cancelled", optionally stores resolution as cancellation reason, and sets updated_at to current timestamp

#### Scenario: Cancel from in_progress (in_progress → cancelled)
- **WHEN** user changes status from "in_progress" to "cancelled"
- **THEN** system updates status to "cancelled", optionally stores resolution as cancellation reason, and sets updated_at to current timestamp

#### Scenario: Reopen completed ticket (completed → open)
- **WHEN** user changes status from "completed" to "open"
- **THEN** system updates status to "open", clears completed_at to NULL, preserves existing resolution, and sets updated_at to current timestamp

#### Scenario: Reopen cancelled ticket (cancelled → open)
- **WHEN** user changes status from "cancelled" to "open"
- **THEN** system updates status to "open", preserves existing resolution, and sets updated_at to current timestamp

### Requirement: Invalid Status Transitions

The system SHALL reject invalid status transitions with appropriate error responses.

#### Scenario: Invalid transition from open to completed
- **WHEN** user attempts to change status from "open" directly to "completed"
- **THEN** system returns 400 Bad Request error with message indicating transition is not allowed and listing allowed transitions (in_progress, cancelled)

#### Scenario: Invalid transition from completed to in_progress
- **WHEN** user attempts to change status from "completed" to "in_progress"
- **THEN** system returns 400 Bad Request error with message indicating transition is not allowed and listing allowed transitions (open)

#### Scenario: Invalid transition from completed to cancelled
- **WHEN** user attempts to change status from "completed" to "cancelled"
- **THEN** system returns 400 Bad Request error with message indicating transition is not allowed and listing allowed transitions (open)

#### Scenario: Invalid transition from cancelled to in_progress
- **WHEN** user attempts to change status from "cancelled" to "in_progress"
- **THEN** system returns 400 Bad Request error with message indicating transition is not allowed and listing allowed transitions (open)

#### Scenario: Invalid transition from cancelled to completed
- **WHEN** user attempts to change status from "cancelled" to "completed"
- **THEN** system returns 400 Bad Request error with message indicating transition is not allowed and listing allowed transitions (open)

### Requirement: Status Transition API

The system SHALL provide a dedicated API endpoint for status transitions.

#### Scenario: Successful status transition
- **WHEN** user calls PATCH /api/tickets/:id/status with valid status and required fields
- **THEN** system performs the transition and returns updated ticket with 200 OK

#### Scenario: Transition with resolution
- **WHEN** user provides resolution field in status transition request
- **THEN** system stores the resolution if the target status allows it (completed, cancelled)

#### Scenario: Transition response includes allowed transitions
- **WHEN** status transition fails due to invalid transition
- **THEN** error response includes current_status, target_status, and allowed_transitions array

### Requirement: Ticket Tag Association

The system SHALL allow associating multiple tags with a ticket.

#### Scenario: Add tag to ticket
- **WHEN** user adds a tag to a ticket
- **THEN** system creates the association between ticket and tag

#### Scenario: Add duplicate tag to ticket
- **WHEN** user adds a tag that is already associated with the ticket
- **THEN** system returns 409 Conflict or ignores silently

#### Scenario: Remove tag from ticket
- **WHEN** user removes a tag from a ticket
- **THEN** system deletes the association between ticket and tag

#### Scenario: Remove non-associated tag
- **WHEN** user removes a tag that is not associated with the ticket
- **THEN** system returns 404 Not Found error

### Requirement: Ticket Priority

The system SHALL support four priority levels: low, medium, high, and urgent.

#### Scenario: Set ticket priority
- **WHEN** user creates or updates a ticket with priority
- **THEN** system stores the priority value

#### Scenario: Default priority
- **WHEN** user creates a ticket without specifying priority
- **THEN** system sets priority to "medium"

### Requirement: Ticket Data Model

The system SHALL store tickets with the following fields: id (UUID), title, description, priority, status, resolution, completed_at, created_at, updated_at.

#### Scenario: Ticket field constraints
- **WHEN** ticket is created or updated
- **THEN** title must not be empty, priority must be one of: low, medium, high, urgent, status must be one of: open, in_progress, completed, cancelled

