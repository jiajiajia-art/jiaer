const DOCTYPE_RE = /^\s*<!doctype[^>]*>/i;
const HTML_RE = /<html\b[^>]*>/i;
const HEAD_OPEN_RE = /<head\b[^>]*>/i;
const BASE_RE = /<base\b[^>]*>/i;

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function buildBaseTag(assetBase: string): string {
  return `<base href="${escapeHtmlAttr(ensureTrailingSlash(assetBase))}">`;
}

export function buildStSceneSrcDoc(html: string, assetBase?: string): string {
  const source = String(html || "");
  const trimmedBase = String(assetBase || "").trim();
  if (!trimmedBase) return source;

  const baseTag = buildBaseTag(trimmedBase);

  if (BASE_RE.test(source)) {
    return source.replace(BASE_RE, baseTag);
  }

  if (HEAD_OPEN_RE.test(source)) {
    return source.replace(HEAD_OPEN_RE, (match) => `${match}${baseTag}`);
  }

  if (HTML_RE.test(source)) {
    return source.replace(HTML_RE, (match) => `${match}<head>${baseTag}</head>`);
  }

  if (DOCTYPE_RE.test(source)) {
    const doctypeMatch = source.match(DOCTYPE_RE)?.[0] || "<!doctype html>";
    const rest = source.slice(doctypeMatch.length);
    return `${doctypeMatch}<html><head>${baseTag}</head><body>${rest}</body></html>`;
  }

  return `<!doctype html><html><head>${baseTag}</head><body>${source}</body></html>`;
}
