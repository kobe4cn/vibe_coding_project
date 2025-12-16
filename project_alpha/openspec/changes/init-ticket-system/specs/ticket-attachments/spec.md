# Ticket Attachments Specification

## ADDED Requirements

### Requirement: Attachment Upload

The system SHALL allow users to upload file attachments to tickets.

#### Scenario: Upload single attachment
- **WHEN** user uploads a file to a ticket
- **THEN** system stores the file and creates an attachment record with filename, content_type, size, and storage_path

#### Scenario: Upload attachment with valid file type
- **WHEN** user uploads a file with allowed content type (images, documents)
- **THEN** system accepts the file and stores it

#### Scenario: Upload attachment exceeding size limit
- **WHEN** user uploads a file larger than 10MB
- **THEN** system returns 413 Payload Too Large error

#### Scenario: Upload attachment with invalid file type
- **WHEN** user uploads a file with disallowed content type
- **THEN** system returns 415 Unsupported Media Type error

#### Scenario: Exceed attachment count limit
- **WHEN** user tries to upload attachment to a ticket that already has 20 attachments
- **THEN** system returns 400 Bad Request error with message about limit exceeded

### Requirement: Attachment Retrieval

The system SHALL provide the ability to list and download attachments.

#### Scenario: List attachments for a ticket
- **WHEN** user requests attachments for a ticket
- **THEN** system returns list of attachment metadata (id, filename, content_type, size, created_at)

#### Scenario: Download attachment
- **WHEN** user requests to download an attachment by ID
- **THEN** system returns the file with correct content type and filename headers

#### Scenario: Download non-existent attachment
- **WHEN** user requests to download an attachment that does not exist
- **THEN** system returns 404 Not Found error

### Requirement: Attachment Deletion

The system SHALL allow users to delete attachments.

#### Scenario: Delete existing attachment
- **WHEN** user requests deletion of an attachment
- **THEN** system removes the attachment record and the stored file

#### Scenario: Delete non-existent attachment
- **WHEN** user requests deletion of non-existent attachment
- **THEN** system returns 404 Not Found error

### Requirement: Attachment Cascade Deletion

The system SHALL automatically delete all attachments when a ticket is deleted.

#### Scenario: Delete ticket with attachments
- **WHEN** user deletes a ticket that has attachments
- **THEN** system removes all attachment records and stored files for that ticket

### Requirement: Attachment Data Model

The system SHALL store attachment metadata with the following fields: id (UUID), ticket_id, filename, storage_path, content_type, size_bytes, created_at.

#### Scenario: Attachment field constraints
- **WHEN** attachment is created
- **THEN** filename, storage_path, and content_type must not be empty, size_bytes must be positive

### Requirement: Attachment Storage Security

The system SHALL store attachments securely to prevent path traversal attacks.

#### Scenario: Secure file naming
- **WHEN** file is uploaded
- **THEN** system generates a UUID-based storage path to prevent malicious filename exploitation

#### Scenario: Storage path isolation
- **WHEN** file is stored
- **THEN** files are organized by ticket_id to ensure isolation

