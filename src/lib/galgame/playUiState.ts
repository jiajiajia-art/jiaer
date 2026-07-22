export function parsePlayUiJson(text: string): any {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    /* fallthrough */
  }

  // 兼容误返回的 SSE 文本：data: {"success":true,...}
  const dataPayloads = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  for (let i = dataPayloads.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(dataPayloads[i]);
    } catch {
      /* keep trying older data payloads */
    }
  }

  // 兼容前后混入日志/说明文本的 JSON 响应。
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(raw.slice(first, last + 1));
    } catch {
      /* fallthrough */
    }
  }

  return null;
}
