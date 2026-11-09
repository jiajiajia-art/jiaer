/**
 * 开局正文：按世界观 / 开局人际 / 主线写；无父母设定时禁止「爸妈来电」惯性模板。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const romance = join(root, "Romance/src");

test("GameContext_开局提示走buildOpeningPlotPrompt_不再写死父母来电", () => {
  const ctx = readFileSync(join(romance, "store/GameContext.tsx"), "utf8");
  assert.match(ctx, /buildOpeningPlotPrompt/);
  assert.match(ctx, /DEFAULT_OPENING_DIRECTIVE/);
  assert.match(ctx, /pickOpeningPromptEvents/);
  assert.match(ctx, /openingPromptEvents:\s*pickOpeningPromptEvents/);
  assert.doesNotMatch(ctx, /父母若有劝阻或牵挂/);
  assert.doesNotMatch(ctx, /电话里的朴素家常话/);
  assert.doesNotMatch(ctx, /关心房租够不够/);
});

test("FixedEventsPanel_须有开局提示词勾选", () => {
  const panel = readFileSync(join(romance, "components/FixedEventsPanel.tsx"), "utf8");
  assert.match(panel, /openingPrompt/);
  assert.match(panel, /开局提示词（进游戏时与开局地点一起生成第一场）/);
  assert.match(panel, /patch\(e\.id,\s*\{\s*openingPrompt:\s*v\s*\|\|\s*undefined\s*\}\)/);
});

test("openingPlotPrompt_无父母时禁止来电_有主线与人际时写入提示", async () => {
  const mod = await import(join(romance, "lib/openingPlotPrompt.ts"));
  const bare = {
    player: { name: "白芊芊", extra: [] },
    npcs: [{ id: "shen", name: "沈姨", relation: "掌柜" }],
    sim: { metPeople: ["shen"], flags: {} },
    relNet: { edges: [] },
  };
  assert.equal(mod.openingParentsAllowed(bare), false);
  const noParent = mod.buildOpeningPlotPrompt({
    location: "旅馆前院",
    game: bare,
    storylines: [
      {
        id: "main",
        name: "安顿下来",
        nodes: [{ id: "n1", name: "先把前院收拾好", desc: "把招牌擦亮" }],
      },
    ],
  });
  assert.match(noParent, /旅馆前院/);
  assert.match(noParent, /沈姨/);
  assert.match(noParent, /安顿下来/);
  assert.match(noParent, /先把前院收拾好/);
  assert.match(noParent, /严禁出现母亲\/父亲\/爸妈来电/);
  assert.doesNotMatch(noParent, /父母若有劝阻或牵挂/);
  assert.doesNotMatch(mod.DEFAULT_OPENING_DIRECTIVE, /父母若有|电话里的朴素家常话/);

  const withMom = {
    ...bare,
    player: { name: "白芊芊", extra: [{ label: "母亲职业", value: "裁缝" }] },
  };
  assert.equal(mod.openingParentsAllowed(withMom), true);
  const ok = mod.buildOpeningPlotPrompt({ location: "家", game: withMom });
  assert.doesNotMatch(ok, /严禁出现母亲\/父亲\/爸妈来电/);

  const picked = mod.pickOpeningPromptEvents([
    { name: "开店", prompt: "雾港早班，招牌要擦亮", openingPrompt: true },
    { name: "勿播", prompt: "不该出现在开局", openingPrompt: false },
    { name: "空", prompt: "   ", openingPrompt: true },
  ]);
  assert.equal(picked.length, 1);
  assert.equal(picked[0].name, "开店");
  const withFx = mod.buildOpeningPlotPrompt({
    location: "旅馆前院",
    game: bare,
    openingPromptEvents: picked,
  });
  assert.match(withFx, /【开局提示词】/);
  assert.match(withFx, /雾港早班，招牌要擦亮/);
  assert.doesNotMatch(withFx, /不该出现在开局/);
});
