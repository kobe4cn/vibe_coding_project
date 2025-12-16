import { describe, it, expect } from 'vitest';
import {
  createTicketSchema,
  updateTicketSchema,
  updateStatusSchema,
  createTagSchema,
  updateTagSchema,
} from './schemas';

describe('createTicketSchema', () => {
  it('validates valid ticket', () => {
    const result = createTicketSchema.safeParse({
      title: 'Test Ticket',
      description: 'Test description',
      priority: 'high',
    });
    expect(result.success).toBe(true);
  });

  it('requires title', () => {
    const result = createTicketSchema.safeParse({
      title: '',
      priority: 'medium',
    });
    expect(result.success).toBe(false);
  });

  it('defaults priority to medium', () => {
    const result = createTicketSchema.parse({
      title: 'Test',
    });
    expect(result.priority).toBe('medium');
  });

  it('rejects invalid priority', () => {
    const result = createTicketSchema.safeParse({
      title: 'Test',
      priority: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('limits title length', () => {
    const result = createTicketSchema.safeParse({
      title: 'a'.repeat(256),
    });
    expect(result.success).toBe(false);
  });
});

describe('updateTicketSchema', () => {
  it('allows partial updates', () => {
    const result = updateTicketSchema.safeParse({
      title: 'New Title',
    });
    expect(result.success).toBe(true);
  });

  it('allows empty update', () => {
    const result = updateTicketSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('updateStatusSchema', () => {
  it('validates valid status', () => {
    const result = updateStatusSchema.safeParse({
      status: 'in_progress',
    });
    expect(result.success).toBe(true);
  });

  it('requires resolution for completed', () => {
    const result = updateStatusSchema.safeParse({
      status: 'completed',
    });
    expect(result.success).toBe(false);
  });

  it('accepts completed with resolution', () => {
    const result = updateStatusSchema.safeParse({
      status: 'completed',
      resolution: 'Fixed the issue',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty resolution for completed', () => {
    const result = updateStatusSchema.safeParse({
      status: 'completed',
      resolution: '   ',
    });
    expect(result.success).toBe(false);
  });
});

describe('createTagSchema', () => {
  it('validates valid tag', () => {
    const result = createTagSchema.safeParse({
      name: 'Bug',
      color: '#EF4444',
    });
    expect(result.success).toBe(true);
  });

  it('requires name', () => {
    const result = createTagSchema.safeParse({
      name: '',
      color: '#EF4444',
    });
    expect(result.success).toBe(false);
  });

  it('validates color format', () => {
    const result = createTagSchema.safeParse({
      name: 'Test',
      color: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid hex color', () => {
    const result = createTagSchema.safeParse({
      name: 'Test',
      color: '#AABBCC',
    });
    expect(result.success).toBe(true);
  });

  it('defaults color', () => {
    const result = createTagSchema.parse({
      name: 'Test',
    });
    expect(result.color).toBe('#6B7280');
  });
});

describe('updateTagSchema', () => {
  it('allows partial updates', () => {
    const result = updateTagSchema.safeParse({
      name: 'New Name',
    });
    expect(result.success).toBe(true);
  });

  it('validates color if provided', () => {
    const result = updateTagSchema.safeParse({
      color: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

