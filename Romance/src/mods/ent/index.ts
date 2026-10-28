/* ═══════════════ 内置世界观模组 · 娱乐圈（星光 2005） ═══════════════
 * 不复制任何数据：全部「引用」现有内容池（worlds/star2005 + game/*），
 * 用 getter 惰性取值，避免与引擎模块形成循环依赖时在模块求值期访问未初始化绑定。
 * 现有玩法保持完全一致——引擎在本模组生效时读到的就是原来那份数据。 */
import type { Mod, ModContent } from "../types";
import {
  ROOMS, PEOPLE, ALL_ITEMS, WORLD, RAW_ENCOUNTERS, RAW_SIDEQUESTS, RAW_SIDEQUEST_CAST, RAW_CONTRACTS, RAW_PROJECTS,
  RAW_IMAGE_CRISIS, RAW_INDUSTRY, RAW_HELP, RAW_RELATIONS,
} from "../../worlds/star2005/content";
import { ENT_MAP } from "../../worlds/star2005/map";
import { ENT_OPENING } from "../../worlds/star2005/opening";
import { WORLD_BOOK_SEED } from "../../worlds/star2005/worldbook";
import {
  GIG_POOL, LOCATIONS, WORLD_RULE_DIMS, RAW_STAT_LABELS, RAW_STATS_BASE, RAW_STAT_ORDER, RAW_TRAININGS, RAW_SIDE_JOBS, RAW_ZODIACS,
  RAW_STYLES, RAW_IDENTITIES, RAW_BACKGROUNDS, RAW_DIRECTIONS, RAW_SCHOOL, RAW_PARENT_JOBS, RAW_CREATION, RAW_WEEKEND_ACTS, RAW_FAME_TIERS,
  RAW_TITLES, RAW_CARS, RAW_NPC_NAME_POOL, RAW_RANDOM_NAMES, RAW_NPC_DIRECTIONS, RAW_NPC_PERSONALITIES, RAW_NPC_PREFS, type NpcPool,
} from "../../game/data";
import { DEFAULT_GIG_PRICES } from "../../game/gigLibrary";
import { LIBRARY_EVENTS, EVENT_LIBRARY } from "../../game/eventLibrary";

/* 与 lib/ai.ts buildSystemPrompt 开篇逐字一致（接线后行为不变） */
export const ENT_GM_INTRO =
  "你是一款名为《今夜她是主角·女明星养成沉浸式模拟器》的中文沉浸式养成模拟器的游戏主持（GM），文风为晋江言情/复古娱乐圈质感，细腻、有画面感、克制而深情。";

let npcPoolCache: NpcPool | null = null;
const entNpcPool = (): NpcPool => (npcPoolCache ??= {
  names: RAW_NPC_NAME_POOL, randomNames: RAW_RANDOM_NAMES, directions: RAW_NPC_DIRECTIONS, personalities: RAW_NPC_PERSONALITIES, prefs: RAW_NPC_PREFS,
});

/* 未配置 AI 时的兜底后记（原 lib/ai.ts mockEpilogue 逐字迁移；{name}=主角名） */
export const ENT_MOCK_EPILOGUE: string[] = [
    `【{name}·后记】`,
    `很多年后，人们提起{name}，总要先顿一顿，像在心里把一整个时代重新走过一遍。`,
    `初春，她拎着一只旧行李箱住进天光公寓的那天，谁也没想到这个在镜子前把转身练到第三十七遍的女孩，会把自己的名字写进华语娱乐圈的年鉴里。那时她一无所有，只有一身不肯认输的倔强，和窗外那盏隔壁常亮到深夜的灯。`,
    `出道的头两年是最难的。她接过没人要的配角，在暴雨里补拍过整夜的戏，也在颁奖礼的角落里，看着别人上台。她学会了在通告车上补眠，学会了把眼泪咽回去再笑给镜头，也学会了辨认哪些递到面前的合同是机会、哪些是陷阱。她跌过、被夺过资源、被黑过热搜，可每一次她都从灰烬里站起来，比从前更亮。`,
    `事业攀上高处时，她终于遇见了那些真正留在生命里的人——有人教她"先信，观众才会信"，有人在她最狼狈时递来一碗热面，也有人把新写的歌，第一个唱给她听。她不是没有软肋的人，只是把软肋都藏进了作品里，于是她的每一个角色都活得那样疼、那样真。`,
    `盛名之下，她做过最勇敢的决定，往往不是接下多大的戏，而是懂得在什么时候说"不"。她把一部分光让给了后来的年轻人，把一部分时间还给了自己，也终于敢在镜头之外，认领属于自己的那份平凡的幸福。`,
    `晚年的{name}很少再谈论奖杯。她说，她记得的都是些很小的事：第一次听见台下有人喊她名字时腿在发抖，深夜排练厅打翻的那杯凉掉的茶，还有很多很多盏，在她看不见的地方，一直为她亮着的灯。`,
    `她把一生活成了一部长剧——有序章的青涩，有高潮的滚烫，也有落幕时的温柔。灯暗下去的时候，她对着空荡荡的舞台鞠了一躬，像在谢幕，也像在道别。`,
    `而那盏灯，据说至今还亮着。`,
  ];

const content: ModContent = {
  get rooms() { return ROOMS; },
  startRoom: "apartment",
  get locations() { return LOCATIONS; },
  startMet: ["linyi"],
  get npcs() { return PEOPLE; },
  get items() { return ALL_ITEMS; },
  get gigs() { return GIG_POOL; },
  get events() { return LIBRARY_EVENTS; },
  fixedEvents: [],
  endings: [],
  get worldBook() { return WORLD_BOOK_SEED; },
  get worldRules() { return WORLD_RULE_DIMS; },
  prompt: { gmIntro: ENT_GM_INTRO, npcExample: { id: "guchen", name: "顾沉" }, endingHint: "成名/隐退/婚恋定局/意外", mockEpilogue: ENT_MOCK_EPILOGUE },
  // —— 内容槽（全部 getter 惰性引用原数据：娱乐圈玩法逐字不变） ——
  get stats() { return { labels: RAW_STAT_LABELS, base: RAW_STATS_BASE, order: RAW_STAT_ORDER }; },
  get trainings() { return RAW_TRAININGS; },
  get sideJobs() { return RAW_SIDE_JOBS; },
  get zodiacs() { return RAW_ZODIACS; },
  startMoney: 5000,
  startDate: "2005.01.03",
  weather: "微雨",
  get map() { return ENT_MAP; },
  get encounters() { return RAW_ENCOUNTERS; },
  get sideQuests() { return RAW_SIDEQUESTS; },
  get sideQuestCast() { return RAW_SIDEQUEST_CAST; },
  get relations() { return RAW_RELATIONS; },
  get calendar() { return WORLD.calendar; },
  get travel() { return WORLD.travel; },
  get contracts() { return RAW_CONTRACTS; },
  get projects() { return RAW_PROJECTS; },
  get imageCrisis() { return RAW_IMAGE_CRISIS; },
  get industry() { return RAW_INDUSTRY; },
  get help() { return RAW_HELP; },
  get opening() { return ENT_OPENING; },
  weeklyPaper: { masthead: "星城娱樂週報" },
  get eventGroups() { return EVENT_LIBRARY; },
  get styles() { return RAW_STYLES; },
  get identities() { return RAW_IDENTITIES; },
  get backgrounds() { return RAW_BACKGROUNDS; },
  get directions() { return RAW_DIRECTIONS; },
  get school() { return RAW_SCHOOL; },
  get parentJobs() { return RAW_PARENT_JOBS; },
  get creation() { return RAW_CREATION; },
  get weekendActs() { return RAW_WEEKEND_ACTS; },
  get fameTiers() { return RAW_FAME_TIERS; },
  get titles() { return RAW_TITLES; },
  get cars() { return RAW_CARS; },
  get npcPool() { return entNpcPool(); },
  get gigPrices() { return DEFAULT_GIG_PRICES; },
  terms: {
    tabWorld: "世界", tabIndustry: "娱乐圈", tabNpc: "人脉", tabPhone: "手机", tabImage: "形象", tabSim: "人物",
    hintWorld: "星城舆图 · 出行探访", hintIndustry: "人气榜 · 票房代言 · 机遇抉择", hintNpc: "圈中往来 · 流言私信",
    hintImage: "公开人设 · 舆情危机", hintSim: "身世属性 · 日程养成 · 通告履历", hintPhone: "微信 · 短信 · 电话 · 微博 · 直播 · 票务",
    gig: "通告", fans: "粉丝", reputation: "口碑", fame: "名气", money: "片酬", works: "作品", advance: "日程",
    city: "星城", industry: "娱乐圈", celebrity: "明星",
  },
  // 只留基础：演艺事业 / 舆情 / 周报 / 座驾 / 孕育 / 生活开销 拆成扩展包 （mods/entPacks.ts），由扩展包开关打开；数据仍放在这里供扩展包引用
  features: { industryTab: false, weeklyPaper: false, career: false, imageCrisis: false, phone: true, pregnancy: false, cars: false },
};

const entMod: Mod = {
  id: "ent",
  name: "娱乐圈 · 星光2005",
  version: "1.0.0",
  author: "内置",
  description: "女明星养成的基础世界：星城地图、圈内人物、日程养成与手机社交。通告事业、舆情、周报、座驾、孕育、生活开销由同名扩展包开关（默认全开）。",
  kind: "world",
  builtin: true,
  content,
};
export default entMod;
