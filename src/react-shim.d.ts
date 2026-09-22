// 本地 React 类型 shim：项目刻意不增加 @types/react 依赖。
// 仅声明本应用实际使用的 API 与 JSX 内置元素，满足 strict 下的 tsc 检查。

declare module "react" {
  export type ReactNode =
    | string
    | number
    | boolean
    | null
    | undefined
    | ReactElement
    | Array<ReactNode>;

  export interface ReactElement {
    type: unknown;
    props: Record<string, unknown>;
    key?: string | null;
  }

  export interface ChangeEvent<T = Element> {
    target: T;
  }

  export interface FormEvent<T = Element> {
    preventDefault(): void;
    target: T;
  }

  type SetStateAction<T> = T | ((prev: T) => T);
  type Dispatch<T> = (value: T) => void;

  export function useState<T>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: unknown[]): T;

  interface ExoticProps {
    children?: ReactNode;
  }
  export const StrictMode: (props: ExoticProps) => ReactElement;
}

declare module "react/jsx-runtime" {
  import type { ReactNode } from "react";
  export const Fragment: unique symbol;
  export function jsx(type: unknown, props: Record<string, unknown>, key?: string): ReactNode;
  export function jsxs(type: unknown, props: Record<string, unknown>, key?: string): ReactNode;
}

declare module "react-dom/client" {
  import type { ReactNode } from "react";
  interface Root {
    render(node: ReactNode): void;
  }
  export function createRoot(container: Element | null): Root;
}

declare namespace JSX {
  interface IntrinsicAttributes {
    key?: string | number | null;
  }

  interface IntrinsicElements {
    [elemName: string]: Record<string, unknown>;
  }

  type Element = import("react").ReactElement;
}
