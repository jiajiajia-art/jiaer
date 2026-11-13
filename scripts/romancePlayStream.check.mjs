import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./_tsExtResolve.mjs", import.meta.url);

globalThis.localStorage = { getItem: (k) => (k === "auth-storage" ? JSON.stringify({ state: { user: { token: "t" } } }) : null), setItem() {}, removeItem() {} };
const { parsePlaySseLine, streamPlayViaPlatform } = await import("../Romance/src/lib/platformPlayAi.ts");

const sse = (chunks, status = 200, type = "text/event-stream") => {
  const enc = new TextEncoder();
  const body = new ReadableStream({ start(c) { for (const x of chunks) c.enqueue(enc.encode(x)); c.close(); } });
  return new Response(body, { status, headers: { "content-type": type } });
};

test("SSE行解析_平台格式与OpenAI格式", () => {
  assert.deepEqual(parsePlaySseLine('data: {"delta":"你好"}').delta, "你好");
  assert.equal(parsePlaySseLine('data: {"choices":[{"delta":{"content":"世界"}}]}').delta, "世界");
  assert.equal(parsePlaySseLine("data: [DONE]").done, true);
  assert.equal(parsePlaySseLine('data: {"done":true,"pointsDeducted":3}').pointsDeducted, 3);
  assert.equal(parsePlaySseLine('data: {"error":"积分不足","code":"INSUFFICIENT_POINTS"}').code, "INSUFFICIENT_POINTS");
  assert.equal(parsePlaySseLine(": keep-alive"), null);
});

test("真流式_逐段回调_跨包断行也能拼对", async () => {
  globalThis.fetch = async (url) => {
    assert.match(String(url), /\/api\/romance\/play\/stream$/);
    return sse(['data: {"delta":"今天"}\n', 'data: {"del', 'ta":"下雨"}\n\ndata: {"done":true,"pointsDeducted":2,"remainingPoints":98}\n']);
  };
  const seen = [];
  const r = await streamPlayViaPlatform([{ role: "user", content: "hi" }], (chunk, full) => seen.push([chunk, full]));
  assert.deepEqual(seen, [["今天", "今天"], ["下雨", "今天下雨"]]);
  assert.equal(r.text, "今天下雨");
  assert.equal(r.pointsDeducted, 2);
  assert.equal(r.remainingPoints, 98);
});

test("后端未上线流式接口_自动退回同步complete", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith("/stream")) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify({ success: true, data: { text: "整段文本" } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const seen = [];
  const r = await streamPlayViaPlatform([{ role: "user", content: "hi" }], (c) => seen.push(c));
  assert.equal(r.text, "整段文本");
  assert.deepEqual(seen, ["整段文本"]);
  assert.match(calls[1], /\/complete$/);
});

test("流中报错_抛出带code的错误", async () => {
  globalThis.fetch = async () => sse(['data: {"delta":"半句"}\n', 'data: {"error":"积分不足","code":"INSUFFICIENT_POINTS"}\n']);
  await assert.rejects(streamPlayViaPlatform([{ role: "user", content: "hi" }], () => {}), (e) => e.code === "INSUFFICIENT_POINTS");
});
