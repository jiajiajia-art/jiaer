/* ═══ 内置玩法 Mod · 头衔扩展包 ═══
 * 合并模式（slotMerge: merge）：只追加新头衔，原世界观的头衔全部保留。
 * 演示头衔条件可用任意指标：名气 / 口碑 / 作品 / 奖项、八维（stat:<键>）、自定义属性（c:<id>）。 */
import type { Mod } from "./types";

const titlesPlusMod: Mod = {
  id: "titles-plus",
  name: "头衔扩展包",
  version: "1.0.0",
  author: "内置玩法 Mod",
  description: "在原有头衔之外新增 12 个能力向 / 成就向头衔，单项能力练到顶尖也能拿到称号。可复制后自行增改。",
  kind: "addon",
  slotMerge: "merge",
  dependencies: ["ent"],
  builtin: true,
  content: {
    titles: [
      { id: "tp_actor", name: "演技派", tier: "白银", req: { "stat:yanji": 400 }, desc: "演技 ≥ 400" },
      { id: "tp_actor2", name: "戏骨", tier: "钻石", req: { "stat:yanji": 800, works: 8 }, desc: "演技 ≥ 800 且作品 ≥ 8" },
      { id: "tp_voice", name: "天籁之音", tier: "黄金", req: { "stat:geyi": 500 }, desc: "歌艺 ≥ 500" },
      { id: "tp_talk", name: "金牌嘴替", tier: "白银", req: { "stat:koucai": 400 }, desc: "口才 ≥ 400" },
      { id: "tp_grace", name: "行走的衣架", tier: "黄金", req: { "stat:yitai": 500 }, desc: "仪态 ≥ 500" },
      { id: "tp_dance", name: "舞台炸场王", tier: "黄金", req: { "stat:donggan": 500 }, desc: "动感 ≥ 500" },
      { id: "tp_iron", name: "铁人", tier: "白银", req: { "stat:tineng": 450 }, desc: "体能 ≥ 450" },
      { id: "tp_brain", name: "学霸艺人", tier: "白银", req: { "stat:caizhi": 450 }, desc: "才智 ≥ 450" },
      { id: "tp_aura", name: "气场全开", tier: "黄金", req: { "stat:zixin": 500 }, desc: "自信 ≥ 500" },
      { id: "tp_clean", name: "零黑料", tier: "钻石", req: { reputation: 95, fame: 200 }, desc: "口碑 ≥ 95 且名气 ≥ 200" },
      { id: "tp_award", name: "奖杯收割机", tier: "钻石", req: { awards: 5 }, desc: "奖项 ≥ 5" },
      { id: "tp_works", name: "劳模", tier: "黄金", req: { works: 12 }, desc: "完成作品 ≥ 12" },
    ],
  },
};
export default titlesPlusMod;
