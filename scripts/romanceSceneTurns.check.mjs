import test from "node:test";
import assert from "node:assert/strict";
import { turnsInCurrentScene } from "../Romance/src/lib/sceneTurns.ts";
const t = (id, role, room, extra = {}) => ({ id, role, room, segments: [], ts: 0, ...extra });
test("only turns since arriving at the current room", () => {
  const story = [t("1", "player", "a"), t("2", "ai", "a"), t("3", "ai", "b"), t("4", "player", "b"), t("5", "ai", "b")];
  assert.deepEqual(turnsInCurrentScene(story, "b").map((x) => x.id), ["3", "4", "5"]);
});
test("just moved: nothing from the old scene", () => {
  const story = [t("1", "player", "a"), t("2", "ai", "a")];
  assert.deepEqual(turnsInCurrentScene(story, "b"), []);
});
test("AI-driven move keeps the triggering player line", () => {
  const story = [t("1", "ai", "a"), t("2", "player", "a"), t("3", "ai", "b", { scene: "B" })];
  assert.deepEqual(turnsInCurrentScene(story, "b").map((x) => x.id), ["2", "3"]);
});
test("legacy turns without room stay visible", () => {
  const story = [t("1", "ai", undefined), t("2", "ai", "b")];
  assert.deepEqual(turnsInCurrentScene(story, "b").map((x) => x.id), ["1", "2"]);
});
test("returning to an earlier room does not resurrect old turns", () => {
  const story = [t("1", "ai", "a"), t("2", "ai", "b"), t("3", "ai", "a")];
  assert.deepEqual(turnsInCurrentScene(story, "a").map((x) => x.id), ["3"]);
});
