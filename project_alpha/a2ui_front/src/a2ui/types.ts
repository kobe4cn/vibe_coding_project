/**
 * A2UI v0.8 TypeScript Types
 * Migrated from a2ui_frontend/client
 */

// Value types
export interface LiteralString {
  literalString: string;
}

export interface LiteralNumber {
  literalNumber: number;
}

export interface LiteralBoolean {
  literalBoolean: boolean;
}

export interface PathValue {
  path: string;
}

export type BoundValue = LiteralString | LiteralNumber | LiteralBoolean | PathValue;

// Data model types
export interface ValueMap {
  key: string;
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueMap?: ValueMap[];
}

// Component types
export interface Component {
  id: string;
  component: Record<string, unknown>;
}

// Children types
export interface ExplicitChildren {
  explicitList: string[];
}

export interface TemplateChildren {
  template: {
    componentId: string;
    dataBinding: string;
  };
}

export type Children = ExplicitChildren | TemplateChildren;

// Action types
export interface ActionContext {
  key: string;
  value: BoundValue;
}

export interface Action {
  name: string;
  context?: ActionContext[];
}

// Message types
export interface SurfaceUpdate {
  surfaceUpdate: {
    surfaceId: string;
    components: Component[];
  };
}

export interface DataModelUpdate {
  dataModelUpdate: {
    surfaceId: string;
    path?: string;
    contents: ValueMap[];
  };
}

export interface BeginRendering {
  beginRendering: {
    surfaceId: string;
    root: string;
  };
}

export interface DeleteSurface {
  deleteSurface: {
    surfaceId: string;
  };
}

export type A2UIMessage = SurfaceUpdate | DataModelUpdate | BeginRendering | DeleteSurface;

// userAction types
export interface UserAction {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string;
  context: Record<string, unknown>;
}

// React integration types
export type DataModelListener = (path: string, value: unknown) => void;

export interface DataModelSnapshot {
  [path: string]: unknown;
}
