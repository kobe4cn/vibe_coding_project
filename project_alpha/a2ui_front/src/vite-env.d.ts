/// <reference types="vite/client" />
/// <reference types="react" />

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// A2UI custom element type declaration
declare namespace JSX {
  interface IntrinsicElements {
    'a2ui-surface': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & { surfaceId?: string },
      HTMLElement
    >;
  }
}
