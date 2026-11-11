/* ═══ 内置扩展包 · 通用玩法包 ═══
 * 玩法包只负责打开功能开关（features），不再把娱乐圈的数据（八维门槛、名气分档、压力 / 造型等内置数值）带进其它世界。
 * - 娱乐圈原版世界：数据仍取自娱乐圈模组（getter 惰性读取），体验与拆包前一致；
 * - 其它世界：getter 返回 undefined（registry 合并时跳过），通告 / 伙食 / 座驾等由作者在编辑器里
 *   按本作品建角属性填写，编辑器只提供不含娱乐圈属性的通用模板。
 * 均为追加合并（slotMerge: merge）。 */
import type { Mod, ModContent } from "./types";
import entMod from "./ent";
import { ENT_BILLS, RAW_MEALS, RAW_CARS } from "../game/data";
import { currentWorldId, currentWorldDeclares } from "./live";
import { contractsStarter, projectsStarter, industryStarter, imageCrisisStarter } from "../lib/packStarters";

const ent = (): ModContent => entMod.content;
/** 功能注释：仅娱乐圈原版世界才回填娱乐圈数据；其它世界不注入（undefined 会被 registry 跳过） */
const entOnly = <T,>(get: () => T): T | undefined => (currentWorldId() === "ent" ? get() : undefined);
/**
 * 功能注释：玩法包底稿（P1）。娱乐圈原版世界仍回填娱乐圈数据；
 * 其它世界：世界扩展配置里写过该槽就用世界的（返回 undefined 让 registry 跳过本包），
 * 没写过才用本包的通用底稿——装上即有数据可玩，不是只亮开关。底稿不含娱乐圈门槛数值。
 */
const packBase = <T,>(key: string, entGet: () => T, base: () => T): T | undefined => {
  if (currentWorldId() === "ent") return entGet();
  if (currentWorldDeclares(key)) return undefined;
  return base();
};
const pack = (id: string, name: string, description: string, content: ModContent): Mod => ({
  id, name, description, version: "1.0.0", author: "内置扩展包", kind: "addon", slotMerge: "merge", dependencies: [], builtin: true, content,
});

/* 原版娱乐圈默认启用的扩展包（新开局默认勾选；老存档读档时自动补上，体验与拆包前一致） */
export const ENT_PACK_IDS = ["pack-career", "pack-image", "pack-paper", "pack-cars", "pack-pregnancy", "pack-living", "pack-relations"];

export const entPacks: Mod[] = [
  pack("pack-career", "事业经营包", "接单、签约、长期项目与行业榜单，附「老板直聘」App。叫法、分类与阵容可在编辑器改成任何题材；门槛与成长按本作品建角属性填写。", {
    features: { career: true, industryTab: true, phoneAppsExtra: ["bosspin"] },
    get gigs() { return entOnly(() => ent().gigs); },
    get gigPrices() { return entOnly(() => ent().gigPrices); },
    get contracts() { return packBase("contracts", () => ent().contracts, () => contractsStarter.starter() as ModContent["contracts"]); },
    get projects() { return packBase("projects", () => ent().projects, () => projectsStarter.starter() as ModContent["projects"]); },
    get industry() { return packBase("industry", () => ent().industry, () => industryStarter.starter() as ModContent["industry"]); },
  }),
  pack("pack-image", "声誉舆情包", "公众形象经营与声誉危机：流言、对立者、公关抉择，口碑随之起落。", {
    features: { imageCrisis: true },
    get imageCrisis() { return packBase("imageCrisis", () => ent().imageCrisis, () => imageCrisisStarter.starter() as ModContent["imageCrisis"]); },
  }),
  pack("pack-paper", "周报包", "每周一份小报，汇总本周的热点、榜单与你的动向（需要行业数据，已一并附带）。", {
    features: { weeklyPaper: true },
    get weeklyPaper() { return packBase("weeklyPaper", () => ent().weeklyPaper, () => ({ masthead: "周报" }) as ModContent["weeklyPaper"]); },
    get industry() { return packBase("industry", () => ent().industry, () => industryStarter.starter() as ModContent["industry"]); },
  }),
  pack("pack-cars", "座驾包", "购车、卖车、切换座驾：出行更快更体面，也是一笔开销。", {
    features: { cars: true },
    get cars() { return packBase("cars", () => ent().cars, () => structuredClone(RAW_CARS) as ModContent["cars"]); },
  }),
  pack("pack-pregnancy", "孕育包", "亲密关系可能带来怀孕：征兆、孕期状态与分娩会随日程推进。", {
    features: { pregnancy: true },
  }),
  /* 生活开销包：核心是「每周吃什么」——玩家在日程板自选伙食，周日随账单结算；外加随名气分档的住行账单。
   * 没挂这个包的世界没有生活开销（世界自己声明了 bills 的除外，如校园的饭卡）。
   * 叠到其他世界上会整份替换该世界的 bills（weekly / monthly / tiers 三键全给，浅合并等同替换）。 */
  pack("pack-living", "生活开销包", "每周吃什么自己选，周日随账单结算；伙食档位、花费与属性影响按本作品建角属性填写。", {
    get meals() { return packBase("meals", () => RAW_MEALS, () => structuredClone(RAW_MEALS)); },
    get bills() { return entOnly(() => ENT_BILLS); },
  }),
  /* 功能注释：头衔玩法包——目录只声明面板；具体头衔写在作品 content.titles，未添加玩法则不出现编辑区 */
  pack("pack-titles", "头衔包", "达标即获得的头衔表。需要的剧本才添加；数值分档请在建角属性里配。", {
    titles: [],
  }),
  /* 功能注释：关系玩法——表白/婚礼/牵线/伴侣加成；娱乐圈默认挂上，其它世界须从商店添加 */
  pack("pack-faction-rep", "阵营声望", "势力声望、建角加入势力、按声望调价、好感外溢；未添加时势力只作设定与人物归属。", {
    features: { factionRep: true },
  }),
  pack("pack-relations", "关系玩法", "表白门槛、婚礼费用与好感、NPC 牵线、伴侣加成。未添加的剧本人物页不出现表白与婚礼入口。", {
    features: { relationsPlay: true },
  }),
];
