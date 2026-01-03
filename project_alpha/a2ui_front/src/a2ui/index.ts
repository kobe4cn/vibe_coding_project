/**
 * A2UI Module - React + Lit hybrid implementation
 */

// Types
export * from './types';

// DataModel
export { DataModel } from './renderer/data-model';

// Lit Renderer (registers custom elements)
export {
  A2UISurface as LitA2UISurface,
  A2UIText,
  A2UIButton,
  A2UITextField,
  A2UIColumn,
  A2UIRow,
  A2UICard,
  A2UIList,
  A2UIIcon,
  A2UIDivider,
  A2UICheckBox,
} from './renderer/renderer';

// React Integration
export { A2UIProvider, useA2UIContext, useA2UIValue, useA2UIState, useA2UISnapshot, useA2UIAction } from './integration/A2UIContext';
export { useA2UI } from './integration/useA2UI';
export { A2UISurface } from './integration/A2UISurface';
export type { A2UISurfaceRef } from './integration/A2UISurface';
