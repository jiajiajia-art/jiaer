/**
 * 测试专用：让 Node 能加载 Vite 风格的无后缀 / 目录导入（'./constants'、'../i18n'）。
 * 同时兜底 JSON 导入（补 type: json）与 Vite 的 import.meta.env（不存在时视为空对象）。
 * 只在需要的校验文件里 `await import('./_tsResolve.mjs')` 后再动态 import 业务模块；不影响构建与业务代码。
 */
import { register } from 'node:module';

const hook = `
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const EXT = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (!/^\\.{1,2}\\//.test(spec) || !ctx.parentURL?.startsWith('file:')) throw e;
    for (const ext of EXT) {
      const url = new URL(spec + ext, ctx.parentURL);
      const p = fileURLToPath(url);
      if (existsSync(p) && statSync(p).isFile()) return next(url.href, ctx);
    }
    throw e;
  }
}
export async function load(url, ctx, next) {
  // Vite 允许直接 import JSON；Node 需要 type: json
  if (url.endsWith('.json')) return next(url, { ...ctx, importAttributes: { ...ctx.importAttributes, type: 'json' } });
  const out = await next(url, ctx);
  // Vite 注入的 import.meta.env 在 Node 里不存在：只在业务 TS 源码里兜成空对象
  if (/\.tsx?$/.test(url) && out.source && !url.includes('/node_modules/')) {
    const src = String(out.source);
    if (src.includes('import.meta.env')) return { ...out, source: src.replace(/import\.meta\.env/g, '(import.meta.env ?? {})') };
  }
  return out;
}`;
register(`data:text/javascript,${encodeURIComponent(hook)}`, import.meta.url);
