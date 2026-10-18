/**
 * 功能注释：前端 STREAM_PERF 控制台比对与 SSE 解析契约。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildStreamPerfDedupeKey,
  buildStreamPerfMetricFingerprint,
  extractStreamPerfFromSseJson,
  formatStreamPerfCompareHint,
  formatStreamPerfConsoleLine,
  formatStreamPerfStopReason,
  getStreamPerfCanvasFirstPaintMs,
  isStreamPerfPayload,
  markStreamPerfCanvasFirstPaint,
  markStreamPerfRequestStart,
  STREAM_PERF_COLUMN_LEGEND,
  STREAM_PERF_STOP_REASON_ZH,
} from '../src/lib/galgame/streamPerfDebug.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('extractStreamPerfFromSseJson_应识别独立事件与data嵌套_勿误匹配', () => {
  const direct = extractStreamPerfFromSseJson({
    type: 'stream_perf',
    timing: { totalMs: 1000, firstContentMs: 200 },
    throughput: { tokensPerSec: 12, completionTokens: 10 },
  });
  assert.ok(isStreamPerfPayload(direct));
  assert.equal(direct?.timing?.totalMs, 1000);

  const nested = extractStreamPerfFromSseJson({
    type: 'data',
    streamPerf: {
      type: 'stream_perf',
      timing: { totalMs: 2000 },
      throughput: { tokensPerSec: 8 },
    },
  });
  assert.equal(nested?.timing?.totalMs, 2000);
  assert.equal(extractStreamPerfFromSseJson({ type: 'step' }), null);
  // 功能注释：仅有 timing+throughput 但无 type/嵌套时不得当 stream_perf
  assert.equal(
    extractStreamPerfFromSseJson({
      type: 'data',
      timing: { totalMs: 1 },
      throughput: { tokensPerSec: 1 },
    }),
    null,
  );
});

test('formatStreamPerfConsoleLine_应含关键字段且不含requestId', () => {
  const line = formatStreamPerfConsoleLine({
    requestId: 1,
    actionId: 'act-1',
    model: 'deepseek-v4.1-flash',
    gatewayBaseUrl: 'https://api.deepseek.com',
    timing: { firstContentMs: 900, totalMs: 3000, generationMs: 2100, canvasFirstPaintMs: 1200 },
    throughput: { tokensPerSec: 40, completionTokens: 84, promptTokens: 1000, contentChars: 200 },
    stopReason: 'stop',
  });
  assert.match(line, /\[STREAM_PERF\]/);
  assert.doesNotMatch(line, /requestId=/);
  assert.match(line, /act-1/);
  assert.match(line, /ttft=900/);
  assert.match(line, /paint=1200/);
  assert.match(line, /tps=40/);
  assert.match(line, /stop=stop｜正常结束/);
  // 功能注释：单行须短，禁止再塞完整 gateway URL / cps / src
  assert.doesNotMatch(line, /https:\/\//);
  assert.doesNotMatch(line, /\bcps=/);
});

test('formatStreamPerfStopReason_常见码应带短中文', () => {
  assert.equal(formatStreamPerfStopReason('stop'), 'stop｜正常结束');
  assert.equal(formatStreamPerfStopReason('protocol_complete'), 'protocol_complete｜协议完整早停');
  assert.equal(formatStreamPerfStopReason('repaired'), 'repaired｜补丁后通过');
  assert.match(formatStreamPerfStopReason('weird_code'), /\｜\?$/);
  assert.ok(STREAM_PERF_STOP_REASON_ZH.repaired);
  assert.ok(STREAM_PERF_STOP_REASON_ZH.protocol_complete);
});

test('canvasFirstPaint_应相对requestStart计时且只记首次', () => {
  markStreamPerfRequestStart(99);
  assert.equal(getStreamPerfCanvasFirstPaintMs(99), null);
  assert.equal(markStreamPerfCanvasFirstPaint(99), true);
  const first = getStreamPerfCanvasFirstPaintMs(99);
  assert.ok(typeof first === 'number' && first >= 0);
  assert.equal(markStreamPerfCanvasFirstPaint(99), false);
  assert.equal(getStreamPerfCanvasFirstPaintMs(99), first);
});

test('buildStreamPerfDedupeKey_同actionId应相同', () => {
  assert.equal(
    buildStreamPerfDedupeKey({ actionId: 'a1', timing: { totalMs: 1 } }),
    buildStreamPerfDedupeKey({ actionId: 'a1', timing: { totalMs: 999 } }),
  );
  assert.notEqual(
    buildStreamPerfDedupeKey({ actionId: 'a1' }),
    buildStreamPerfDedupeKey({ actionId: 'a2' }),
  );
});

test('buildStreamPerfMetricFingerprint_数字相同应合并', () => {
  const a = {
    actionId: 'x',
    model: 'deepseek-flash',
    gatewayBaseUrl: 'https://api.deepseek.com',
    timing: { totalMs: 4707, firstContentMs: 1103, generationMs: 3604 },
    throughput: { completionTokens: 604, contentChars: 1086 },
    stopReason: 'protocol_complete',
  };
  const b = { ...a, actionId: 'y', requestId: 2 };
  assert.equal(buildStreamPerfMetricFingerprint(a), buildStreamPerfMetricFingerprint(b));
});

test('如何比对文案_应列全且tps含义写清', () => {
  assert.doesNotMatch(STREAM_PERF_COLUMN_LEGEND, /requestId=/);
  assert.match(STREAM_PERF_COLUMN_LEGEND, /ttftMs=/);
  assert.match(STREAM_PERF_COLUMN_LEGEND, /paintMs=/);
  assert.match(STREAM_PERF_COLUMN_LEGEND, /totalMs=/);
  assert.match(STREAM_PERF_COLUMN_LEGEND, /genMs=/);
  assert.match(STREAM_PERF_COLUMN_LEGEND, /tps=吞吐\(tokens\/s\)/);
  assert.match(STREAM_PERF_COLUMN_LEGEND, /completionTok/);
  assert.match(STREAM_PERF_COLUMN_LEGEND, /outTok=/);
  assert.match(STREAM_PERF_COLUMN_LEGEND, /inTok=/);
  assert.match(STREAM_PERF_COLUMN_LEGEND, /chars=/);
  assert.match(STREAM_PERF_COLUMN_LEGEND, /stop=/);
  const hint = formatStreamPerfCompareHint(1);
  assert.match(hint, /n=1/);
  assert.match(hint, /本页仅此一次/);
  assert.doesNotMatch(hint, /requestId=/);
});

test('useStepStreamResponse与换局清空_应接线STREAM_PERF', () => {
  const src = readFileSync(join(root, 'src/hooks/story/useStepStreamResponse.ts'), 'utf8');
  assert.match(src, /recordAndLogStreamPerf/);
  assert.match(src, /extractStreamPerfFromSseJson/);
  assert.match(src, /recordAndLogStreamPerf\(streamPerf,\s*\{\s*requestId\s*\}\)/);

  const step = readFileSync(join(root, 'src/hooks/galgame/useGalgameStep.ts'), 'utf8');
  assert.match(step, /clearStreamPerfHistory/);
  assert.match(step, /markStreamPerfRequestStart/);
  assert.match(step, /markStreamPerfCanvasFirstPaint/);

  const perfSrc = readFileSync(join(root, 'src/lib/galgame/streamPerfDebug.ts'), 'utf8');
  assert.match(perfSrc, /toConsoleTableObject/);
  // 功能注释：(index) 列须为 1/2/3，禁止用 actionId 当 console.table 键
  assert.match(perfSrc, /out\[String\(idx \+ 1\)\]/);
  assert.doesNotMatch(perfSrc, /console\.table\(history\.map/);
  assert.doesNotMatch(perfSrc, /^\s*i,/m);
});

test('开局自动重发_应用固定bootstrapActionId且可跳过', () => {
  const ctrl = readFileSync(join(root, 'src/hooks/galgame/useGalgameController.ts'), 'utf8');
  assert.match(ctrl, /buildBootstrapStartActionId/);
  assert.match(ctrl, /shouldSkipOpeningStartAutoResend/);
  assert.match(ctrl, /isOpeningStartActionText/);
  const helper = readFileSync(join(root, 'src/lib/galgame/bootstrapStartAction.ts'), 'utf8');
  assert.match(helper, /bootstrap-start/);
});

test('sendActionStream_streamPerf不得再挂data或done', () => {
  const send = readFileSync(
    join(root, '../Interactive-fiction-backend/interface/handlers/visual/sendActionStream.js'),
    'utf8',
  );
  assert.match(send, /JSON\.stringify\(streamPerf\)/);
  assert.doesNotMatch(send, /\.\.\.\(streamPerf \? \{ streamPerf \} : \{\}\)/);
});
