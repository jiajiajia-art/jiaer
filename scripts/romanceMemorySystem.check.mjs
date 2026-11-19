import test from "node:test";
import assert from "node:assert/strict";
import { applyMemory, memoryBlock, recalledMemoryIds } from "../Romance/src/lib/chronicle.ts";
import { hybridRetrieve, textSimilarity } from "../Romance/src/lib/memory/retrieval.ts";
import { decideWrite, retention, forget, digestPastDays, promote } from "../Romance/src/lib/memory/lifecycle.ts";
import { stylePresetSystemBlock, stylePresetPostHistory, BASE_STYLE_PRESET } from "../Romance/src/lib/presets/stylePreset.ts";

const base = () => ({ turnCount: 1, world: { time: "t" }, sim: { day: 1, room: "lobby" },
  npcs: [{ id: "a", name: "林若雪", aliases: [] }, { id: "b", name: "沈渔", aliases: [] }], worldBook: [] });
const ctx = { roomName: (id) => ({ lobby: "大堂", yard: "后院" })[id] ?? id ?? "", defaultBook: () => [] };

test("写入决策：UPDATE 让旧事实双时态失效，不再注入", () => {
  let g = applyMemory(base(), [{ text: "林若雪住在城东的公寓", imp: 2 }], undefined, ctx);
  g = { ...g, sim: { day: 2, room: "lobby" } };
  g = applyMemory(g, [{ text: "林若雪搬到了城西", imp: 2, op: "update", replaces: "林若雪住在城东的公寓" }], undefined, ctx);
  const old = g.chronicle.find((e) => e.text.includes("城东"));
  assert.equal(old.invalidAt, 2);
  assert.ok(old.supersededBy);
  const blk = memoryBlock(g, "林若雪", [], ctx.roomName);
  assert.ok(blk.includes("城西") && !blk.includes("城东"), blk);
});
test("写入决策：本地识别同主体的变化措辞为 UPDATE；DELETE 只失效不新增", () => {
  const items = [{ id: "x", day: 1, text: "沈渔和主角在交往", who: ["b"], imp: 2 }];
  assert.equal(decideWrite(items, { text: "沈渔和主角分手了", who: ["b"] }).op, "UPDATE");
  assert.equal(decideWrite(items, { text: "沈渔和主角在交往", who: ["b"] }).op, "NOOP");
  assert.equal(decideWrite(items, { text: "后院种了樱花", who: [] }).op, "ADD");
  let g = applyMemory(base(), [{ text: "主角答应周末陪沈渔看电影", imp: 2 }], undefined, ctx);
  g = applyMemory(g, [{ text: "看电影的约定取消", op: "delete", replaces: "答应周末陪沈渔看电影" }], undefined, ctx);
  assert.equal(g.chronicle.length, 1);
  assert.ok(g.chronicle[0].invalidAt != null);
});
test("关键事件被推翻时，对应世界书条目停用", () => {
  let g = applyMemory(base(), [{ text: "沈渔是卧底", imp: 3 }], undefined, ctx);
  assert.equal(g.worldBook[0].enabled, true);
  g = applyMemory(g, [{ text: "沈渔其实不是卧底", imp: 3, op: "update", replaces: "沈渔是卧底" }], undefined, ctx);
  assert.equal(g.worldBook.find((b) => b.content.includes("沈渔是卧底")).enabled, false);
});
test("混合检索：语义 / 关键词 / 图遍历都能召回，无关查询不召回", () => {
  const docs = [
    { id: "1", text: "沈渔把旧怀表交给主角保管", who: ["b"], room: "lobby", keys: ["怀表"] },
    { id: "2", text: "后院的井被封了", who: [], room: "yard", keys: [] },
    { id: "3", text: "林若雪和沈渔是大学同学", who: ["a", "b"], keys: [] },
  ];
  assert.equal(hybridRetrieve(docs, { text: "那块怀表还在吗", entities: [] })[0].id, "1");
  assert.ok(hybridRetrieve(docs, { text: "", entities: ["a"] }).some((r) => r.id === "3"));
  assert.equal(hybridRetrieve(docs, { text: "今天天气不错", entities: [] }).length, 0);
  assert.ok(textSimilarity("沈渔把怀表交给主角", "沈渔把旧怀表交给主角保管") > 0.5);
});
test("遗忘曲线：重要度与召回次数延长保持率；琐事衰减后被清理", () => {
  const e1 = { id: "a", day: 0, text: "x", who: [], imp: 1 };
  const e2 = { ...e1, imp: 2 };
  assert.ok(retention(e2, 10) > retention(e1, 10));
  assert.ok(retention({ ...e1, recalls: 3, lastRecall: 8 }, 10) > retention(e1, 10));
  const many = Array.from({ length: 50 }, (_, i) => ({ id: `n${i}`, day: i < 5 ? 0 : 99, text: `t${i}`, who: [], imp: 1 }));
  assert.equal(forget(many, 100).length, 45);
});
test("巩固：重要事件过夜晋升长期；过往日常归并为当日经过", () => {
  assert.equal(promote([{ id: "a", day: 1, text: "x", who: [], imp: 2 }], 2)[0].tier, "long");
  const items = [1, 2, 3].map((i) => ({ id: `d${i}`, day: 3, text: `日常${i}`, who: [], imp: 1 }));
  const out = digestPastDays(items, 9, (day, parts) => ({ id: "dg", day, text: parts.map((p) => p.text).join("；"), who: [], imp: 1, kind: "digest" }));
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "digest");
});
test("召回加固：被注入的记忆召回次数累加", () => {
  let g = applyMemory(base(), [{ text: "沈渔送了主角一把伞", imp: 2 }], undefined, ctx);
  g = { ...g, sim: { day: 9, room: "yard" } };
  for (let i = 0; i < 6; i++) g = applyMemory(g, [{ text: `闲事${i}` }], undefined, ctx);
  const ids = recalledMemoryIds(g, "那把伞", [], ctx.roomName);
  assert.equal(ids.length, 1);
  g = applyMemory(g, [], undefined, { ...ctx, recalled: ids });
  assert.equal(g.chronicle.find((e) => e.id === ids[0]).recalls, 1);
});
test("文风基底预设：按顺序注入，模型适配项只对 DeepSeek 生效", () => {
  const blk = stylePresetSystemBlock("gpt-4o");
  assert.ok(blk.includes("剧情连续性") && blk.includes("多人剧情兼容"));
  assert.ok(!blk.includes("deepseek-tavern-v2-pro"));
  assert.ok(stylePresetSystemBlock("deepseek-chat").includes("deepseek-tavern-v2-pro"));
  assert.ok(blk.indexOf("剧情连续性") < blk.indexOf("自然收束"));
  assert.ok(stylePresetPostHistory().includes("承接用户最新输入"));
  assert.equal(BASE_STYLE_PRESET.prompts.length, 15);
});
