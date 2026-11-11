// 功能注释：测试用解析钩子——Node 直跑 TS 时把无扩展名的相对导入补成 .ts / .tsx
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (e) {
    if (!(specifier.startsWith(".") || specifier.startsWith("/")) || /\.[cm]?[jt]sx?$/.test(specifier)) throw e;
    for (const ext of [".ts", ".tsx"]) {
      try { return await next(specifier + ext, context); } catch { /* 试下一个 */ }
    }
    throw e;
  }
}
