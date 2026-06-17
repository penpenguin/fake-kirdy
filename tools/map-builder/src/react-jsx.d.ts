import type { JSX as ReactJsx } from 'react';

declare global {
  namespace JSX {
    type Element = ReactJsx.Element;
  }
}

export {};
