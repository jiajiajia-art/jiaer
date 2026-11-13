import test from "node:test";
import assert from "node:assert/strict";
import { moneyStance, moneyDecision } from "../Romance/src/lib/chatMoneyStance.ts";
test("polite refusals with thanks are refusals", () => {
  for (const t of ["谢谢你，但这钱我不能要", "谢谢啦，心意我领了，钱你收回去吧", "收到了，不过我不能收，退给你", "谢谢宝贝，你自己留着花", "真不用，别破费了，谢谢", "这个我不好意思收"]) assert.equal(moneyStance(t), "refuse", t);
});
test("plain acceptances still accept", () => {
  for (const t of ["谢谢！收下啦", "那我就不客气了", "收到了，爱你"]) assert.equal(moneyStance(t), "accept", t);
});
test("text refusal beats AI flag accept_money=true", () => {
  assert.equal(moneyDecision(true, "谢谢你，但这钱我不能要"), "refuse");
  assert.equal(moneyDecision(true, "嗯嗯好的"), "accept");
  assert.equal(moneyDecision(undefined, "今天好累"), undefined);
});
