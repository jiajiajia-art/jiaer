/* ═══ 内置扩展包 · 娱乐圈专属玩法拆包 ═══
 * 把原版娱乐圈里相对独立的玩法系统拆成可单独叠加的扩展包：可以挂到任何世界观上（如校园、自建世界）。
 * 内容直接引用娱乐圈模组的数据（getter 惰性读取，始终与原版同步）；娱乐圈原版已自带这些玩法，再叠加无副作用。
 * 均为追加合并（slotMerge: merge），不依赖任何世界观。 */
import type { Mod, ModContent } from "./types";
import entMod from "./ent";
import { ENT_BILLS, RAW_MEALS } from "../game/data";

const ent = (): ModContent => entMod.content;
const pack = (id: string, name: string, description: string, content: ModContent): Mod => ({
  id, name, description, version: "1.0.0", author: "内置扩展包", kind: "addon", slotMerge: "merge", dependencies: [], builtin: true, content,
});

/* 原版娱乐圈默认启用的扩展包（新开局默认勾选；老存档读档时自动补上，体验与拆包前一致） */
export const ENT_PACK_IDS = ["pack-career", "pack-image", "pack-paper", "pack-cars", "pack-pregnancy", "pack-living", "pack-relations"];

export const entPacks: Mod[] = [
  pack("pack-career", "演艺事业包", "通告接单、签约合约、影视项目与行业榜单，附「老板直聘」App。给任何世界加上一份可经营的演艺事业。", {
    features: { career: true, industryTab: true, phoneAppsExtra: ["bosspin"] },
    get gigs() { return ent().gigs; },
    get gigPrices() { return ent().gigPrices; },
    get contracts() { return ent().contracts; },
    get projects() { return ent().projects; },
    get industry() { return ent().industry; },
  }),
  pack("pack-image", "舆情人设包", "公开人设经营与舆情危机：黑粉、热搜、公关抉择，口碑随之起落。", {
    features: { imageCrisis: true },
    get imageCrisis() { return ent().imageCrisis; },
  }),
  pack("pack-paper", "娱乐周报包", "每周一份小报，汇总本周的热点、榜单与你的动向（需要行业数据，已一并附带）。", {
    features: { weeklyPaper: true },
    get weeklyPaper() { return ent().weeklyPaper; },
    get industry() { return ent().industry; },
  }),
  pack("pack-cars", "座驾包", "购车、卖车、切换座驾：出行更快更体面，也是一笔开销。", {
    features: { cars: true },
    get cars() { return ent().cars; },
  }),
  pack("pack-pregnancy", "孕育包", "亲密关系可能带来怀孕：征兆、孕期状态与分娩会随日程推进。", {
    features: { pregnancy: true },
  }),
  /* 生活开销包：核心是「每周吃什么」——玩家在日程板自选伙食，周日随账单结算；外加随名气分档的住行账单。
   * 没挂这个包的世界没有生活开销（世界自己声明了 bills 的除外，如校园的饭卡）。
   * 叠到其他世界上会整份替换该世界的 bills（weekly / monthly / tiers 三键全给，浅合并等同替换）。 */
  pack("pack-living", "生活开销包", "每周吃什么自己选：泡面省钱伤身，轻食私厨养人费钱，周日随账单结算。另有随名气分档的住行开销——新人住小公寓，越红住得越好也越贵。金额按娱乐圈标准，挂到小额世界前建议先看「数值体检」。", {
    get meals() { return RAW_MEALS; },
    get bills() { return ENT_BILLS; },
  }),
  /* 功能注释：头衔玩法包——目录只声明面板；具体头衔写在作品 content.titles，未添加玩法则不出现编辑区 */
  pack("pack-titles", "头衔包", "达标即获得的头衔表。需要的剧本才添加；数值分档请在建角属性里配。", {
    titles: [],
  }),
  /* 功能注释：关系玩法——表白/婚礼/牵线/伴侣加成；娱乐圈默认挂上，其它世界须从商店添加 */
  pack("pack-relations", "关系玩法", "表白门槛、婚礼费用与好感、NPC 牵线、伴侣加成。未添加的剧本人物页不出现表白与婚礼入口。", {
    features: { relationsPlay: true },
  }),
];
