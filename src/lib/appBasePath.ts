/**
 * 功能注释：从 Vite BASE_URL 得到应用路径前缀（无尾斜杠）。
 * cn-prod 为 /funloom；cn-test 同机构建可为 /funloom-test。
 */
export function getAppBasePath(): string {
  const raw = String(import.meta.env.BASE_URL || '/funloom/').trim() || '/funloom/';
  const withSlash = raw.endsWith('/') ? raw : `${raw}/`;
  const trimmed = withSlash.replace(/\/+$/, '');
  return trimmed || '/funloom';
}

/**
 * 功能注释：拼到本站路径（自动带 base），如 home → /funloom/home
 */
export function appPath(path: string): string {
  const base = getAppBasePath();
  const p = String(path || '').replace(/^\/+/, '');
  return p ? `${base}/${p}` : `${base}/`;
}
