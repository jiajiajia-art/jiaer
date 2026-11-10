/* ═══════════════ 内置世界观模组 · 本体（空白底稿） ═══════════════
 * 保留引擎结构与可编辑表单：星座、日历、出行、关系维度、通告价目。
 * 娱乐圈预置内容（地点、人物、物品、通告、事件、出道路线、合约 / 项目 / 行业 / 舆情等）已清空，
 * 每个槽都显式写空值，避免引擎回退到 worlds/star2005 的娱乐圈默认数据。 */
import type { Mod, ModContent } from "../types";
import { WORLD, RAW_RELATIONS } from "../../worlds/star2005/content";
import { WORLD_RULE_DIMS, ALL_STAT_KEYS, RAW_ZODIACS, RAW_FAME_TIERS, type NpcPool } from "../../game/data";
import { DEFAULT_GIG_PRICES } from "../../game/gigLibrary";
import { contractsStarter, projectsStarter, industryStarter, imageCrisisStarter } from "../../lib/packStarters";

export const ENT_GM_INTRO = "你是一款中文沉浸式养成模拟器的游戏主持（GM），文风细腻、有画面感。";
export const ENT_MOCK_EPILOGUE: string[] = ["【{name}·后记】", "故事在这里告一段落。"];

const emptyNpcPool: NpcPool = { names: [], randomNames: [], directions: [], personalities: [], prefs: [] } as unknown as NpcPool;
let starterCache: Pick<ModContent, "contracts" | "projects" | "industry" | "imageCrisis"> | null = null;
const starters = () => (starterCache ??= {
  contracts: contractsStarter.starter() as ModContent["contracts"],
  projects: projectsStarter.starter() as ModContent["projects"],
  industry: industryStarter.starter() as ModContent["industry"],
  imageCrisis: imageCrisisStarter.starter() as ModContent["imageCrisis"],
});

const content: ModContent = {
  rooms: { home: { name: "住所", desc: "", exits: {} } } as unknown as ModContent["rooms"],
  startRoom: "home",
  locations: [],
  startMet: [],
  npcs: [],
  items: [],
  gigs: [],
  events: [],
  fixedEvents: [],
  endings: [],
  worldBook: [],
  get worldRules() { return WORLD_RULE_DIMS; },
  prompt: { gmIntro: ENT_GM_INTRO, endingHint: "", mockEpilogue: ENT_MOCK_EPILOGUE },
  // 功能注释：不预设八维；内置能力槽全部停用，属性由作者在编辑器「建角属性」(customAttrs) 自定义，条数不限
  stats: { order: [], hidden: [...ALL_STAT_KEYS] },
  customAttrs: [],
  trainings: [],
  sideJobs: [],
  get zodiacs() { return RAW_ZODIACS; },
  startMoney: 5000,
  startDate: "2005.01.03",
  weather: "晴",
  encounters: [],
  sideQuests: [],
  sideQuestCast: {},
  get relations() { return RAW_RELATIONS; },
  get calendar() { return WORLD.calendar; },
  get travel() { return WORLD.travel; },
  get contracts() { return starters().contracts; },
  get projects() { return starters().projects; },
  get imageCrisis() { return starters().imageCrisis; },
  get industry() { return starters().industry; },
  help: { intro: "", docs: [] } as unknown as ModContent["help"],
  opening: { kicker: "", title: "", paragraphs: [], waiting: "", cta: "开始" } as unknown as ModContent["opening"],
  weeklyPaper: { masthead: "周报" },
  eventGroups: [],
  styles: [],
  identities: [],
  backgrounds: [],
  directions: [],
  school: "",
  parentJobs: [],
  creation: { paths: [], pathTitle: "", identityOpts: [], backgroundOpts: [], klassOpts: [], cta: "开始" },
  weekendActs: [],
  get fameTiers() { return RAW_FAME_TIERS; },
  titles: [],
  cars: [],
  npcPool: emptyNpcPool,
  get gigPrices() { return DEFAULT_GIG_PRICES; },
  terms: {
    tabWorld: "世界", tabIndustry: "事业", tabNpc: "人脉", tabPhone: "手机", tabImage: "形象", tabSim: "人物",
    hintWorld: "地图 · 出行探访", hintIndustry: "事业 · 机遇抉择", hintNpc: "人际往来",
    hintImage: "公开形象", hintSim: "属性 · 日程养成", hintPhone: "手机应用",
    gig: "工作", fans: "粉丝", reputation: "口碑", fame: "名气", money: "收入", works: "作品", advance: "日程",
    city: "", industry: "", celebrity: "",
  },
  features: { industryTab: false, weeklyPaper: false, career: false, imageCrisis: false, phone: true, pregnancy: false, cars: false },
};

const entMod: Mod = {
  id: "ent",
  name: "本体",
  version: "2.0.0",
  author: "内置",
  description: "内置本体世界（空白底稿）：保留属性、日程、手机与玩法包结构，内容在编辑器里自行填写。",
  kind: "world",
  builtin: true,
  content,
};
export default entMod;
