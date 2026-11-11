import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeEventNotice, tickEventNotices, noticeRoomOf, noticeDaysLeft, nextTurnCueBlock } from "../Romance/src/lib/eventNotices.ts";

const host = (turnCount, day, eventNotices) => ({ turnCount, sim: { day }, eventNotices });

test("事件发生地_进入触发房间优先_其次条件地点_最后当前地点", () => {
  assert.equal(noticeRoomOf({ trigger: { kind: "enter", room: "lobby" } }, "street"), "lobby");
  assert.equal(noticeRoomOf({ conds: [{ kind: "location", key: "roof" }] }, "street"), "roof");
  assert.equal(noticeRoomOf({}, "street"), "street");
});

test("未限时_下回合过期_限时_按天倒计时到0失败", () => {
  const a = makeEventNotice(host(5, 10), { kind: "event", refId: "e1", name: "停摆钟" }, "n1");
  const b = makeEventNotice(host(5, 10), { kind: "event", refId: "e2", name: "旧登记本", limitDays: 3 }, "n2");
  let g = host(5, 10, [a, b]);
  let t = tickEventNotices(g);
  assert.equal(t.expired.length + t.failed.length, 0, "同一回合不变");
  g = host(6, 11, [a, b]);
  t = tickEventNotices(g);
  assert.deepEqual(t.expired.map((x) => x.refId), ["e1"]);
  assert.equal(t.failed.length, 0);
  assert.equal(noticeDaysLeft(b, 11), 2);
  t = tickEventNotices(host(9, 13, t.g.eventNotices));
  assert.deepEqual(t.failed.map((x) => x.refId), ["e2"]);
  assert.equal(t.g.eventNotices.find((x) => x.id === "n2").status, "failed");
});

test("下一回合提示_含上回合事件与可展开事件_要求不得替玩家展开", () => {
  const n = makeEventNotice(host(1, 0), { kind: "event", refId: "e", name: "停摆钟", summary: "大堂的钟停在三点", room: "lobby", limitDays: 2 }, "n");
  const block = nextTurnCueBlock(["【属性升档：理智】跌到「动摇」"], [n], 1, (r) => (r === "lobby" ? "大堂" : r));
  assert.match(block, /属性升档/);
  assert.match(block, /停摆钟（大堂）：大堂的钟停在三点；剩 1 天/);
  assert.match(block, /不得替玩家展开/);
  assert.equal(nextTurnCueBlock([], [], 0, (r) => r), "");
});

test("自动检查不再自动调AI_事件进支线", () => {
  const ctx = readFileSync(new URL("../Romance/src/store/GameContext.tsx", import.meta.url), "utf8");
  const a = ctx.indexOf("const runFixedCheck = useCallback(");
  const body = ctx.slice(a, ctx.indexOf("runFixedRef.current = runFixedCheck;", a));
  assert.doesNotMatch(body, /runTurn\(/, "runFixedCheck 里不得再调用 runTurn");
  assert.doesNotMatch(body, /playQuestRef\.current\?\.\(/, "条件支线不自动展开");
  assert.match(body, /addNotice\(/);
  assert.match(body, /pendingCues/);
  assert.match(ctx, /const playEventNotice = useCallback/);
  // 关键词支线也先进列表，不再自动展开
  assert.doesNotMatch(ctx, /setTimeout\(\(\) => playQuestRef\.current\?\.\(hit\.id\)/);
  assert.match(ctx, /kind: "quest", refId: hit\.id/);
});

test("解析失败不当成功回合", () => {
  const ctx = readFileSync(new URL("../Romance/src/store/GameContext.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(ctx, /step \?\? \{ options: \[\], narration: prose \}/);
  assert.match(ctx, /buildStepRepairMessages\(msgs, full/);
  assert.match(ctx, /状态没解析成功/);
});

test("状态块本地容错与失败原因", async () => {
  const { parseStepJson } = await import("../Romance/src/lib/stepParse.ts");
  assert.deepEqual(parseStepJson('正文\n```json\n{"options":["a","b",], // 注释\n"world":{}}\n```').obj?.options, ["a", "b"]);
  assert.equal(parseStepJson('正文\n```json\n{"options":["a"],"world":{"no').reason, "truncated");
  assert.equal(parseStepJson("只有正文").reason, "no-json");
  assert.equal(parseStepJson("```json\n{options: [1]}\n```").reason, "invalid");
  assert.deepEqual(parseStepJson('正文\n```json\n{"options":["a"]}').obj?.options, ["a"], "缺结尾 ``` 但完整的块可读");
});

test("特殊事件只能在发生地触发_列表提供前往", () => {
  const ctx = readFileSync(new URL("../Romance/src/store/GameContext.tsx", import.meta.url), "utf8");
  const a = ctx.indexOf("const playEventNotice = useCallback(");
  const body = ctx.slice(a, ctx.indexOf("}, [busy, commitSim, persist, runTurn]);", a));
  assert.match(body, /if \(n\.room && n\.room !== g\.sim\.room\) return;/);
  assert.doesNotMatch(body, /room: n\.room, visited/, "不得自动把主角挪过去");
  const panel = readFileSync(new URL("../Romance/src/components/StoryQuestPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /simMove\(n\.room!\)/);
  assert.match(panel, />\s*前往\s*</);
  const home = readFileSync(new URL("../Romance/src/components/HomeTab.tsx", import.meta.url), "utf8");
  assert.match(home, /n\.status === "open" && n\.room === id/, "发生地亮「!」");
});
