/**
 * 功能注释：游玩 stream 性能调试——把后端 SSE stream_perf 打到控制台，并缓存最近 N 次便于比对吞吐差异。
 */

export type StreamPerfSnapshot = {
  type?: string;
  sid?: string | null;
  actionId?: string | null;
  /** 功能注释：前端本局 stream 请求序号，与「流式接收」日志 requestId 对齐 */
  requestId?: number | string | null;
  provider?: string | null;
  model?: string | null;
  gatewayBaseUrl?: string | null;
  timing?: {
    firstReadMs?: number | null;
    firstContentMs?: number | null;
    totalMs?: number | null;
    generationMs?: number | null;
    /**
     * 功能注释：画布首字(ms)——从发起 stream 到画布第一次出现可见旁白。
     * 通常 ≥ ttftMs（还含协议清洗、SSE、React 上屏）；体感「多久出字」看这个。
     */
    canvasFirstPaintMs?: number | null;
  };
  throughput?: {
    contentChars?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    tokensPerSec?: number;
    charsPerSec?: number;
    wallTokensPerSec?: number;
    tokenSource?: string;
  };
  stopReason?: string | null;
  truncated?: boolean;
  attempts?: number;
  at?: string;
};

const HISTORY_KEY = '__FUNLOOM_STREAM_PERF__';
const PAINT_MARKS_KEY = '__FUNLOOM_STREAM_PERF_PAINT__';
const LEGEND_SHOWN_KEY = '__FUNLOOM_STREAM_PERF_LEGEND__';
const MAX_HISTORY = 30;

type PaintMark = {
  startedAt: number;
  firstPaintAt: number | null;
};

type PaintMarksStore = Record<string, PaintMark>;

/**
 * 功能注释：STREAM_PERF.stop 英文码 → 中文说明（表内显示「码｜中文」）。
 * 覆盖 openai/豆包 finishReason、协议早停、补丁完成与异常中断。
 */
/** 功能注释：stop 码短中文（控制台要短，勿写长句） */
export const STREAM_PERF_STOP_REASON_ZH: Record<string, string> = {
  stop: '正常结束',
  done: '流结束',
  protocol_complete: '协议完整早停',
  repaired: '补丁后通过',
  length: '输出截断',
  max_tokens: '输出截断',
  max_content_chars: '长度截断',
  max_duration: '时长中断',
  max_bytes: '字节中断',
  idle_timeout: '空闲超时',
  abort: '已中止',
  consumer_stop: '业务停流',
  eof: '读到末尾',
  read_error: '读流出错',
  content_filter: '安全拦截',
  content_filter_end: '安全拦截',
  scene_fallback_choice: '模板选项未过',
  unknown: '未知',
};

/** 功能注释：stop 显示为「码｜短中文」 */
export function formatStreamPerfStopReason(stopReason: unknown): string {
  const code = String(stopReason ?? '').trim();
  if (!code || code === '-') return '-';
  const zh = STREAM_PERF_STOP_REASON_ZH[code];
  if (zh) return `${code}｜${zh}`;
  return `${code}｜?`;
}

/**
 * 功能注释：表头全量说明（每页只打一次）。
 * tps=tokens per second：生成段每秒产出多少 completion token，越高出字越快。
 */
export const STREAM_PERF_COLUMN_LEGEND = [
  'actionId=本回合幂等 id',
  'model=文案模型',
  'gateway=实际请求网关 host',
  'ttftMs=模型首字(ms)：后端收到第一个正文 token',
  'paintMs=画布首字(ms)：发起请求→画布第一次出字',
  'totalMs=整段墙钟(ms)：发请求→流结束（含选项收尾）',
  'genMs=生成段(ms)=totalMs−ttftMs',
  'tps=吞吐(tokens/s)=completionTok÷(genMs/1000)，生成段每秒产出 token 数，越高模型出字越快',
  'outTok=输出 token 数(completionTok)',
  'inTok=输入/上下文 token 数(promptTok)',
  'chars=输出字符数',
  'stop=结束原因(英文码｜中文，如 repaired｜补丁后通过)',
].join('；');

/** 功能注释：浏览器用 window；Node 单测用 globalThis，避免 ReferenceError */
function getPerfGlobal(): Record<string, unknown> {
  if (typeof window !== 'undefined') return window as unknown as Record<string, unknown>;
  return globalThis as unknown as Record<string, unknown>;
}

function getHistoryStore(): StreamPerfSnapshot[] {
  const w = getPerfGlobal();
  if (!Array.isArray(w[HISTORY_KEY])) w[HISTORY_KEY] = [];
  return w[HISTORY_KEY] as StreamPerfSnapshot[];
}

function getPaintMarksStore(): PaintMarksStore {
  const w = getPerfGlobal();
  if (!w[PAINT_MARKS_KEY] || typeof w[PAINT_MARKS_KEY] !== 'object') {
    w[PAINT_MARKS_KEY] = {};
  }
  return w[PAINT_MARKS_KEY] as PaintMarksStore;
}

function paintMarkKey(requestId: number | string | null | undefined): string | null {
  if (requestId === undefined || requestId === null) return null;
  const key = String(requestId).trim();
  return key || null;
}

/** 功能注释：发起 action/stream 时打点，供画布首字相对计时 */
export function markStreamPerfRequestStart(requestId: number | string): void {
  const key = paintMarkKey(requestId);
  if (!key) return;
  getPaintMarksStore()[key] = {
    startedAt: Date.now(),
    firstPaintAt: null,
  };
}

/**
 * 功能注释：画布第一次出现可见旁白时打点（只记首次）。
 * @returns 本次是否为首次上屏
 */
export function markStreamPerfCanvasFirstPaint(requestId: number | string | null | undefined): boolean {
  const key = paintMarkKey(requestId);
  if (!key) return false;
  const store = getPaintMarksStore();
  const mark = store[key];
  if (!mark) {
    store[key] = { startedAt: Date.now(), firstPaintAt: Date.now() };
    return true;
  }
  if (mark.firstPaintAt != null) return false;
  mark.firstPaintAt = Date.now();
  return true;
}

/** 功能注释：相对发起请求的画布首字耗时；尚未上屏则 null */
export function getStreamPerfCanvasFirstPaintMs(
  requestId: number | string | null | undefined,
): number | null {
  const key = paintMarkKey(requestId);
  if (!key) return null;
  const mark = getPaintMarksStore()[key];
  if (!mark || mark.firstPaintAt == null) return null;
  return Math.max(0, mark.firstPaintAt - mark.startedAt);
}

/** 功能注释：换 session / 新开局时清空，避免上一局残留看起来像「一局多条」 */
export function clearStreamPerfHistory(): void {
  const w = getPerfGlobal();
  w[HISTORY_KEY] = [];
  w[PAINT_MARKS_KEY] = {};
  w[LEGEND_SHOWN_KEY] = false;
}

/** 功能注释：缩短 actionId，避免 console 一行过长 */
function shortActionId(actionId: unknown): string {
  const s = String(actionId || '').trim();
  if (!s) return '-';
  if (s.length <= 28) return s;
  return `${s.slice(0, 12)}…${s.slice(-8)}`;
}

function shortGateway(url: unknown): string {
  const s = String(url || '').trim();
  if (!s) return '-';
  try {
    return new URL(s).host || s;
  } catch {
    return s.length > 24 ? `${s.slice(0, 24)}…` : s;
  }
}

/** 功能注释：同一次 LLM 回合的去重键（actionId 优先） */
export function buildStreamPerfDedupeKey(perf: StreamPerfSnapshot): string {
  const actionId = String(perf.actionId || '').trim();
  if (actionId) return `action:${actionId}`;
  const rid = perf.requestId;
  if (rid !== undefined && rid !== null && String(rid).trim() !== '') {
    return `request:${rid}`;
  }
  return `fallback:${buildStreamPerfMetricFingerprint(perf)}`;
}

/**
 * 功能注释：指标指纹——开局若并发打了两次 stream（不同 actionId）但数字完全一样，只保留一条。
 */
export function buildStreamPerfMetricFingerprint(perf: StreamPerfSnapshot): string {
  const t = perf.timing || {};
  const th = perf.throughput || {};
  return [
    perf.model || '',
    perf.gatewayBaseUrl || '',
    t.totalMs ?? '',
    t.firstContentMs ?? t.firstReadMs ?? '',
    t.generationMs ?? '',
    th.completionTokens ?? '',
    th.contentChars ?? '',
    perf.stopReason || '',
  ].join('|');
}

/** 功能注释：是否像 stream_perf 事件（后端 type=stream_perf，或挂在 data.streamPerf） */
export function isStreamPerfPayload(value: unknown): value is StreamPerfSnapshot {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (row.type === 'stream_perf') return true;
  return Boolean(row.timing && row.throughput);
}

export function extractStreamPerfFromSseJson(jsonData: unknown): StreamPerfSnapshot | null {
  if (!jsonData || typeof jsonData !== 'object') return null;
  const row = jsonData as Record<string, unknown>;
  if (row.type === 'stream_perf' && isStreamPerfPayload(row)) return row;
  if (row.streamPerf && isStreamPerfPayload(row.streamPerf)) {
    return row.streamPerf as StreamPerfSnapshot;
  }
  // 功能注释：禁止用「有 timing+throughput」误匹配其它业务包，避免假多条
  return null;
}

export function formatStreamPerfConsoleLine(perf: StreamPerfSnapshot): string {
  const t = perf.timing || {};
  const th = perf.throughput || {};
  return [
    '[STREAM_PERF]',
    shortActionId(perf.actionId),
    perf.model || '-',
    shortGateway(perf.gatewayBaseUrl),
    `ttft=${t.firstContentMs ?? t.firstReadMs ?? '-'}`,
    `paint=${t.canvasFirstPaintMs ?? '-'}`,
    `total=${t.totalMs ?? '-'}`,
    `gen=${t.generationMs ?? '-'}`,
    `tps=${th.tokensPerSec ?? 0}`,
    `out=${th.completionTokens ?? 0}`,
    `in=${th.promptTokens ?? 0}`,
    `stop=${formatStreamPerfStopReason(perf.stopReason)}`,
  ].join(' ');
}

/** 功能注释：每页首条带全量表头；之后只打短行+table */
export function formatStreamPerfCompareHint(historyLen: number): string {
  return `[STREAM_PERF] 列说明(本页仅此一次) n=${historyLen}｜${STREAM_PERF_COLUMN_LEGEND}`;
}

/** 功能注释：表行精简列，去掉 at/长 URL，避免 console.table 刷屏 */
function toTableRow(row: StreamPerfSnapshot) {
  return {
    actionId: shortActionId(row.actionId),
    model: row.model,
    gateway: shortGateway(row.gatewayBaseUrl),
    ttftMs: row.timing?.firstContentMs ?? row.timing?.firstReadMs,
    paintMs: row.timing?.canvasFirstPaintMs ?? '-',
    totalMs: row.timing?.totalMs,
    genMs: row.timing?.generationMs,
    tps: row.throughput?.tokensPerSec,
    outTok: row.throughput?.completionTokens,
    inTok: row.throughput?.promptTokens,
    chars: row.throughput?.contentChars,
    stop: formatStreamPerfStopReason(row.stopReason),
  };
}

/**
 * 功能注释：用「1/2/3…」作对象键，console.table 的 (index) 列才是数字；
 * 勿用 actionId 当键，否则 (index) 会显示成 visua… 截断串。
 */
function toConsoleTableObject(history: StreamPerfSnapshot[]): Record<string, ReturnType<typeof toTableRow>> {
  const out: Record<string, ReturnType<typeof toTableRow>> = {};
  history.forEach((row, idx) => {
    out[String(idx + 1)] = toTableRow(row);
  });
  return out;
}

/**
 * 功能注释：记录一次吞吐；按 actionId / requestId / 指标指纹去重，避免「一局看起来多条相同」。
 * @returns 是否新写入历史（重复则为 false）
 */
export function recordAndLogStreamPerf(
  perf: StreamPerfSnapshot,
  opts?: { requestId?: number | string | null },
): boolean {
  const requestId = opts?.requestId ?? perf.requestId ?? null;
  const canvasFirstPaintMs = getStreamPerfCanvasFirstPaintMs(requestId);
  const merged: StreamPerfSnapshot = {
    ...perf,
    requestId,
    timing: {
      ...(perf.timing || {}),
      canvasFirstPaintMs:
        canvasFirstPaintMs
        ?? perf.timing?.canvasFirstPaintMs
        ?? null,
    },
  };
  const history = getHistoryStore();
  const key = buildStreamPerfDedupeKey(merged);
  const fingerprint = buildStreamPerfMetricFingerprint(merged);
  const dup = history.some(
    (row) =>
      buildStreamPerfDedupeKey(row) === key
      || buildStreamPerfMetricFingerprint(row) === fingerprint,
  );
  if (dup) {
    return false;
  }
  history.push(merged);
  while (history.length > MAX_HISTORY) history.shift();

  const g = getPerfGlobal();
  // 功能注释：表头说明每页只打一次，之后只打短行 + table，避免控制台刷长文
  if (!g[LEGEND_SHOWN_KEY]) {
    g[LEGEND_SHOWN_KEY] = true;
    // eslint-disable-next-line no-console
    console.info(formatStreamPerfCompareHint(history.length));
  }
  // eslint-disable-next-line no-console
  console.info(formatStreamPerfConsoleLine(merged));
  try {
    // eslint-disable-next-line no-console
    console.table(toConsoleTableObject(history));
  } catch {
    /* ignore */
  }
  return true;
}
