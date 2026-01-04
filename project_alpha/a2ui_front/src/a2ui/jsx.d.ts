import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'a2ui-surface': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          surfaceId?: string;
          class?: string;  // Lit uses class instead of className
        },
        HTMLElement
      >;
    }
  }
}
