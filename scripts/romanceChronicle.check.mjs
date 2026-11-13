import test from "node:test";
import assert from "node:assert/strict";
import { applyMemory, memoryBlock, relDay, chronicleFallbackSummary } from "../Romance/src/lib/chronicle.ts";
const base = () => ({ turnCount: 3, world: { time: "第1周 周二" }, sim: { day: 5, room: "lobby" },
  npcs: [{ id: "a", name: "林若雪", aliases: [] }, { id: "b", name: "沈渔", aliases: ["老板娘"] }], worldBook: [] });
const ctx = { roomName: (id) => ({ lobby: "大堂", yard: "后院" })[id] ?? id ?? "", defaultBook: () => [] };
test("relDay", () => { assert.equal(relDay(5,5),"今天"); assert.equal(relDay(5,4),"昨天"); assert.equal(relDay(20,5),"约 2 周前"); });
test("events record day/room/who and key events go to worldbook", () => {
  const g = applyMemory(base(), [{ text: "林若雪把房卡交给主角", imp: 1 }, { text: "老板娘说后山不能去", imp: 3, keys: ["后山"] }], undefined, ctx);
  assert.equal(g.chronicle.length, 2);
  assert.deepEqual(g.chronicle[0].who, ["a"]);
  assert.equal(g.chronicle[0].day, 5); assert.equal(g.chronicle[0].room, "lobby");
  assert.equal(g.worldBook.length, 1); assert.ok(g.worldBook[0]._mem);
  assert.ok(g.worldBook[0].keywords.includes("沈渔") && g.worldBook[0].keywords.includes("后山"));
});
test("dedupe and npc scope ignored", () => {
  let g = applyMemory(base(), [{ text: "同一句" }], undefined, ctx);
  g = applyMemory(g, [{ text: "同一句" }, { scope: "npc", npc: "沈渔", text: "x" }], undefined, ctx);
  assert.equal(g.chronicle.length, 1);
});
test("scene facts change-driven; looks only for present in block", () => {
  let g = applyMemory(base(), [], { facts: ["前台的铜铃坏了"], looks: [{ name: "沈渔", outfit: "深蓝旗袍" }, { name: "林若雪", outfit: "米白开衫" }] }, ctx);
  g = applyMemory(g, [], { facts: ["前台的铜铃修好了"] }, ctx);
  assert.deepEqual(g.sceneMem.lobby.facts, ["前台的铜铃修好了"]);
  const blk = memoryBlock(g, "", ["a"], ctx.roomName);
  assert.ok(blk.includes("林若雪：米白开衫")); assert.ok(!blk.includes("深蓝旗袍"));
  assert.equal(applyMemory(g, [], { facts: [] }, ctx), g);
});
test("recent shown with relative time; old ones recalled only on hit", () => {
  let g = base();
  g = applyMemory(g, [{ text: "沈渔提到旧照片", imp: 2 }], undefined, ctx);
  g = { ...g, sim: { day: 9, room: "yard" } };
  for (let i = 0; i < 6; i++) g = applyMemory(g, [{ text: `日常${i}` }], undefined, ctx);
  const none = memoryBlock(g, "随便聊聊", [], ctx.roomName);
  assert.ok(!none.includes("旧照片"));
  const hit = memoryBlock(g, "我想问沈渔", [], ctx.roomName);
  assert.ok(hit.includes("4 天前 · 大堂] 沈渔提到旧照片"), hit);
  assert.ok(hit.includes("[今天 · 后院] 日常5"));
});
test("fallback summary uses events", () => {
  const g = applyMemory(base(), [{ text: "关键的事", imp: 2 }], undefined, ctx);
  assert.ok(chronicleFallbackSummary(g).includes("关键的事"));
});
