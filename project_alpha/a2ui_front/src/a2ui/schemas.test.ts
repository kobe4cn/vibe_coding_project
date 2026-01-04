/**
 * Tests for A2UI Zod Schema Validation
 */
import { describe, it, expect } from 'vitest';
import {
  A2UIMessageSchema,
  BoundValueSchema,
  ValueMapSchema,
  ComponentSchema,
  validateA2UIMessage,
  formatValidationError,
  getMessageType,
} from './schemas';

describe('BoundValueSchema', () => {
  it('validates literalString', () => {
    const result = BoundValueSchema.safeParse({ literalString: 'hello' });
    expect(result.success).toBe(true);
  });

  it('validates literalNumber', () => {
    const result = BoundValueSchema.safeParse({ literalNumber: 42 });
    expect(result.success).toBe(true);
  });

  it('validates literalBoolean', () => {
    const result = BoundValueSchema.safeParse({ literalBoolean: true });
    expect(result.success).toBe(true);
  });

  it('validates path', () => {
    const result = BoundValueSchema.safeParse({ path: '/app/data/value' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid value', () => {
    const result = BoundValueSchema.safeParse({ invalid: 'key' });
    expect(result.success).toBe(false);
  });
});

describe('ValueMapSchema', () => {
  it('validates string value', () => {
    const result = ValueMapSchema.safeParse({
      key: 'name',
      valueString: 'John',
    });
    expect(result.success).toBe(true);
  });

  it('validates nested valueMap', () => {
    const result = ValueMapSchema.safeParse({
      key: 'user',
      valueMap: [
        { key: 'name', valueString: 'John' },
        { key: 'age', valueNumber: 30 },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('ComponentSchema', () => {
  it('validates component', () => {
    const result = ComponentSchema.safeParse({
      id: 'button-1',
      component: {
        Button: {
          label: { literalString: 'Click me' },
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('A2UIMessageSchema', () => {
  it('validates surfaceUpdate', () => {
    const message = {
      surfaceUpdate: {
        surfaceId: 'main',
        components: [
          {
            id: 'text-1',
            component: { Text: { content: { literalString: 'Hello' } } },
          },
        ],
      },
    };
    const result = A2UIMessageSchema.safeParse(message);
    expect(result.success).toBe(true);
  });

  it('validates dataModelUpdate', () => {
    const message = {
      dataModelUpdate: {
        surfaceId: 'main',
        path: '/app/data',
        contents: [{ key: 'title', valueString: 'Test' }],
      },
    };
    const result = A2UIMessageSchema.safeParse(message);
    expect(result.success).toBe(true);
  });

  it('validates beginRendering', () => {
    const message = {
      beginRendering: {
        surfaceId: 'main',
        root: 'root-component',
      },
    };
    const result = A2UIMessageSchema.safeParse(message);
    expect(result.success).toBe(true);
  });

  it('validates deleteSurface', () => {
    const message = {
      deleteSurface: {
        surfaceId: 'main',
      },
    };
    const result = A2UIMessageSchema.safeParse(message);
    expect(result.success).toBe(true);
  });

  it('rejects invalid message', () => {
    const message = {
      invalidType: {
        surfaceId: 'main',
      },
    };
    const result = A2UIMessageSchema.safeParse(message);
    expect(result.success).toBe(false);
  });
});

describe('validateA2UIMessage', () => {
  it('returns success with data for valid message', () => {
    const message = {
      beginRendering: {
        surfaceId: 'main',
        root: 'root',
      },
    };
    const result = validateA2UIMessage(message);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(message);
  });

  it('returns error for invalid message', () => {
    const message = { invalid: 'data' };
    const result = validateA2UIMessage(message);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('formatValidationError', () => {
  it('formats error correctly', () => {
    const message = { invalid: 'data' };
    const result = validateA2UIMessage(message);
    if (!result.success && result.error) {
      const formatted = formatValidationError(result.error);
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    }
  });
});

describe('getMessageType', () => {
  it('identifies surfaceUpdate', () => {
    const message = { surfaceUpdate: { surfaceId: 'main', components: [] } };
    expect(getMessageType(message)).toBe('surfaceUpdate');
  });

  it('identifies dataModelUpdate', () => {
    const message = { dataModelUpdate: { surfaceId: 'main', contents: [] } };
    expect(getMessageType(message)).toBe('dataModelUpdate');
  });

  it('identifies beginRendering', () => {
    const message = { beginRendering: { surfaceId: 'main', root: 'root' } };
    expect(getMessageType(message)).toBe('beginRendering');
  });

  it('identifies deleteSurface', () => {
    const message = { deleteSurface: { surfaceId: 'main' } };
    expect(getMessageType(message)).toBe('deleteSurface');
  });
});
