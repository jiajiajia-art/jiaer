/** 功能注释：Romance 经 Vite virtual 模块嵌入；仅声明类型，不把 Romance 源码纳入 funloom tsc */
declare module 'virtual:romance-app' {
  import type { ComponentType } from 'react';
  const RomanceApp: ComponentType;
  export default RomanceApp;
}

declare module 'virtual:romance-css' {
  const css: void;
  export default css;
}
