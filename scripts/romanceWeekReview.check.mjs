import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildWeekDiaryMessages, parseWeekDiary } from "../Romance/src/lib/weekReview.ts";

const report = { week: 3, act: "打工", gains: ["收入 +300"], events: [{ tag: "剧情", text: "遇见赵春莲" }], settle: [], warnings: ["压力过高"] };

test("周记_提示词只含本局真实数据_要求约800字第一人称", () => {
  const [sys, user] = buildWeekDiaryMessages({ worldName: "伪人旅馆", playerName: "林", report, changes: ["压力 +12"], money: (n) => `${n}元`, goal: { lineName: "旧登记本", stepName: "找到前台钥匙", done: 1, total: 4 }, daysLeft: 20, memory: "上周在大堂见过老周" });
  assert.match(String(sys.content), /约 800 字/);
  assert.match(String(sys.content), /第一行只写日记标题/, "纯文本格式才能边写边显示");
  assert.match(String(sys.content), /第一人称/);
  assert.match(String(sys.content), /不得编造/);
  for (const k of ["伪人旅馆", "遇见赵春莲", "压力过高", "找到前台钥匙", "还剩 20 天", "上周在大堂见过老周"]) assert.match(String(user.content), new RegExp(k));
});

test("周记_容错解析_过短视为失败", () => {
  const long = "今天".repeat(150);
  const r = parseWeekDiary("```json\n" + JSON.stringify({ title: "雨夜的登记本", text: long }) + "\n```");
  assert.equal(r?.title, "雨夜的登记本");
  assert.equal(r?.text, long);
  assert.equal(parseWeekDiary('{"title":"短","text":"太短了"}'), null);
  assert.equal(parseWeekDiary(long)?.text, long, "未按 JSON 输出时整段当正文");
});

test("周报纯代码驱动_周记进日记本_日记读作品自定义属性", () => {
  const card = readFileSync(new URL("../Romance/src/components/WeekReportCard.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(card, /complete\(/, "周属性总结不调 AI");
  assert.match(card, /onOpenDiary/);
  const ctx = readFileSync(new URL("../Romance/src/store/GameContext.tsx", import.meta.url), "utf8");
  assert.match(ctx, /weekDiaryRef\.current\?\.\(weekReport/);
  // 功能注释：周记走真流式（streamChat 逐段回调），不是写完再假装打字
  assert.match(ctx, /const full = await streamChat\(cfg, req,/);
  assert.match(ctx, /setWeekDiaryLive/);
  assert.match(ctx, /weekDiaryRef\.current\?\.\(spanReport/);
  assert.match(ctx, /for \(const d of g\?\.attrDefs \?\? \[\]\)/);
  assert.doesNotMatch(ctx, /有人开始记住你了|练习见效/);
  const shell = readFileSync(new URL("../Romance/src/components/GameShell.tsx", import.meta.url), "utf8");
  assert.match(shell, /label="日记本"/);
});
