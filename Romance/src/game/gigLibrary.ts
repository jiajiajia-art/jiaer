// ═══════════════ 通告库·大全 (Gig Library) ═══════════════
// 广告 / 电视剧 / 电影 / 唱片 各 100 档，全部确定性生成、名称唯一、决不重复。
// 影视类附带题材(genre)、玩家出演角色(role)与该剧男女主/男女配角阵容(cast)。
// 生成过程用固定种子的伪随机数，保证每次运行结果一致——同一存档看到的通告库不会变。

import type { Gig, GigCast, StatKey } from "./data";

/* 固定种子伪随机（mulberry32）：可复现，保证通告库稳定不抖动。 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 角色姓名素材（虚构，用于剧组阵容） ──
const SUR = ["沈", "陆", "顾", "谢", "苏", "林", "江", "楚", "裴", "宋", "唐", "薛", "白", "温", "郑", "韩", "叶", "许", "夏", "秦", "程", "季", "钟", "崔", "陈", "方", "傅", "洛", "萧", "路"];
const FEM = ["婉清", "语嫣", "初晴", "念安", "疏影", "云舒", "锦书", "雪柔", "清晏", "栖迟", "灯灯", "望舒", "以沫", "知夏", "宜宁", "月泠", "梨落", "南乔", "静姝", "青禾", "晚晴", "阿满", "书宁", "见微", "如许", "微澜", "拾荒", "拂晓", "小茉", "小满"];
const MAL = ["景琛", "慕远", "砚之", "亦然", "明轩", "云深", "皓然", "听澜", "执之", "长风", "既明", "怀瑾", "北辰", "临舟", "承宇", "望川", "沉舟", "屿舟", "行简", "崇光", "澈之", "君彦", "怀山", "肖然", "越泽", "疏朗", "凛之", "亭舟", "叙白", "南岫"];

function pickName(rng: () => number, bank: string[]): string {
  const sur = SUR[Math.floor(rng() * SUR.length)];
  const given = bank[Math.floor(rng() * bank.length)];
  return sur + given;
}

// ── 影视剧名素材：T1×T2 组合可得数百个唯一片名 ──
const T1 = ["长安", "锦绣", "春深", "星河", "云间", "南栀", "旧梦", "初晴", "暖阳", "花事", "青禾", "繁枝", "浮生", "微光", "斑斓", "流年", "半夏", "清欢", "深巷", "归途", "蔷薇", "逐光", "江海", "雾港", "山海", "白露", "晚风", "朝暮", "望月", "听雨", "孤城", "烟波", "碧落", "红尘", "故园", "长夜", "空港", "沉香", "落雨", "千机"];
const T2 = ["记", "令", "歌", "赋", "传", "录", "书", "誓", "约", "劫", "缘", "事", "谣", "阙", "笺"];

// ── 唱片名素材：M1×M2 组合，风格与剧名区分 ──
const M1 = ["夏天的", "雨后的", "逆光", "晚安", "小星星", "蓝色", "橙色", "第七个", "会飞的", "一个人的", "写给你的", "再见", "勇敢", "温柔", "星期天", "盛夏", "浪花", "风筝", "候鸟", "萤火", "北极星", "橘子", "海边的", "旧唱片", "纸飞机"];
const M2 = ["恋歌", "情书", "进行曲", "小夜曲", "协奏曲", "练习曲", "主题曲", "狂想曲", "安眠曲", "独白", "日记", "街角", "晴天", "约定", "远方", "答案", "秘密", "翅膀", "脚步", "微笑"];

// ── 广告品牌与品类 ──
const BRAND = ["沁颜", "潮起", "云裳", "甜橙", "极光", "锦书", "漫步", "月光", "星澜", "黛色", "栖梧", "流光", "青柠", "暮野", "知微", "鹿岛", "川原", "素问", "南屿", "昭华", "翎羽", "白鹭", "远山", "拾光", "浮岚"];
const AD_CATS: { genre: string; products: string[] }[] = [
  { genre: "美妆护肤", products: ["雪肌霜", "水润精华", "气垫粉底", "唇釉", "补水面膜", "淡香水"] },
  { genre: "饮料食品", products: ["鲜橙汽水", "乳酸饮品", "苏打气泡水", "牛奶巧克力", "夹心饼干", "冰红茶"] },
  { genre: "数码手机", products: ["S1 直板手机", "银翼翻盖机", "口红 MP3", "卡片数码相机", "无线随身听"] },
  { genre: "时装服饰", products: ["春季新装", "牛仔系列", "轻羽绒服", "风衣大片", "碎花连衣裙"] },
  { genre: "珠宝腕表", products: ["钻石项链", "陶瓷腕表", "永恒对戒", "珍珠耳环"] },
  { genre: "运动户外", products: ["缓震跑鞋", "训练服", "轻量背包", "羽毛球拍"] },
  { genre: "日化家清", products: ["柔顺洗发水", "亮白牙膏", "花香沐浴露", "滋润护手霜"] },
  { genre: "汽车出行", products: ["家用轿车", "两厢小车", "都市概念车"] },
];
const AD_TYPES = ["平面广告", "TVC 广告", "品牌代言", "形象代言", "广告硬照"];

const TV_GENRES = ["校园", "古装", "都市", "言情", "乡村", "悬疑", "家庭", "职场", "军旅", "年代", "武侠", "商战"];
const FILM_GENRES = ["文艺", "爱情", "悬疑", "武侠", "历史", "青春", "犯罪", "喜剧", "动作", "奇幻"];
const REC_GENRES = ["流行", "民谣", "摇滚", "R&B", "古风", "电子", "爵士", "抒情", "舞曲"];
const REC_TYPES = ["个人单曲", "数字单曲", "首张专辑", "概念专辑", "团体唱片", "巡回演唱会", "跨年演唱会"];

// 星级分布：18/24/26/20/12（新人档到封神档由多到少）
function starOf(i: number): number {
  if (i < 18) return 1;
  if (i < 42) return 2;
  if (i < 68) return 3;
  if (i < 88) return 4;
  return 5;
}

/* 价目表（按星级 1~5）：每个世界可经模组槽 gigPrices 覆盖；缺省 = 娱乐圈原价 */
export type GigPriceTable = { fameReq?: number[]; payBase?: number[]; fameReward?: number[]; days?: number[]; energy?: number[] };
export const DEFAULT_GIG_PRICES: Required<GigPriceTable> = {
  fameReq: [0, 45, 120, 230, 410],
  payBase: [32000, 85000, 175000, 340000, 820000],
  fameReward: [10, 20, 34, 68, 140],
  days: [1, 2, 2, 3, 4],
  energy: [9, 11, 13, 16, 22],
};
let FAME_REQ = DEFAULT_GIG_PRICES.fameReq;
let PAY_BASE = DEFAULT_GIG_PRICES.payBase;
let FAME_REW = DEFAULT_GIG_PRICES.fameReward;
let DAYS = DEFAULT_GIG_PRICES.days;
let ENERGY = DEFAULT_GIG_PRICES.energy;
const STAT_PRIMARY = [55, 115, 185, 255, 335];
const GROW_PRIMARY = [6, 12, 16, 22, 30];

function jit(rng: () => number, base: number, spread = 0.16): number {
  return Math.round(base * (1 + (rng() - 0.5) * 2 * spread));
}

type Cat = "ad" | "tv" | "film" | "record";

// 各类别主/次能力口径：广告看仪态、电视剧看演技、电影看演技/才智、唱片看歌艺/动感
const CAT_STATS: Record<Cat, { primary: StatKey; secondary: StatKey; third?: StatKey; payMul: number }> = {
  ad: { primary: "yitai", secondary: "zixin", payMul: 0.85 },
  tv: { primary: "yanji", secondary: "koucai", third: "yitai", payMul: 1 },
  film: { primary: "yanji", secondary: "zixin", third: "caizhi", payMul: 1.35 },
  record: { primary: "geyi", secondary: "donggan", third: "tineng", payMul: 1.1 },
};

/* 生成一部影视剧的四位主角阵容与玩家出演角色（玩家为女性，出演女主角或女配角/客串） */
function makeCast(rng: () => number, star: number): { cast: GigCast; role: string } {
  const cast: GigCast = {
    femaleLead: pickName(rng, FEM),
    maleLead: pickName(rng, MAL),
    femaleSupport: pickName(rng, FEM),
    maleSupport: pickName(rng, MAL),
  };
  let role: string;
  if (star >= 4) role = "女主角";
  else if (star === 3) role = rng() < 0.55 ? "女主角" : "女配角";
  else if (star === 2) role = rng() < 0.5 ? "女配角" : "重要配角";
  else role = rng() < 0.5 ? "客串" : "女配角";
  return { cast, role };
}

/* 组合两组词得到指定数量的唯一片名（确定性洗牌后切片，保证各类别不撞名）。 */
function uniqueTitles(a: string[], b: string[], seed: number): string[] {
  const all: string[] = [];
  for (const x of a) for (const y of b) all.push(x + y);
  // Fisher–Yates（固定种子）
  const rng = mulberry32(seed);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

// 影视片名总池（tv 取前 100，film 取次 100，互不重叠）
const DRAMA_TITLES = uniqueTitles(T1, T2, 20050101);
const RECORD_TITLES = uniqueTitles(M1, M2, 20050202);

function buildStatReq(rng: () => number, cat: Cat, star: number): Partial<Record<StatKey, number>> {
  const s = CAT_STATS[cat];
  const base = STAT_PRIMARY[star - 1];
  const req: Partial<Record<StatKey, number>> = { [s.primary]: jit(rng, base, 0.12) };
  if (star >= 3) req[s.secondary] = jit(rng, base * 0.6, 0.14);
  if (star >= 5 && s.third) req[s.third] = jit(rng, base * 0.55, 0.14);
  return req;
}

function buildGrow(rng: () => number, cat: Cat, star: number): Partial<Record<StatKey, number>> {
  const s = CAT_STATS[cat];
  const base = GROW_PRIMARY[star - 1];
  const grow: Partial<Record<StatKey, number>> = { [s.primary]: jit(rng, base, 0.14) };
  grow[s.secondary] = Math.max(3, Math.round(base * 0.4));
  return grow;
}

function makeAd(i: number, rng: () => number, seen: Set<string>): Gig {
  const star = starOf(i);
  let brand = "", product = "", type = "", catDef = AD_CATS[0], name = "";
  // 重掷直到品牌·品类·形式组合唯一，杜绝重名
  do {
    brand = BRAND[Math.floor(rng() * BRAND.length)];
    catDef = AD_CATS[Math.floor(rng() * AD_CATS.length)];
    product = catDef.products[Math.floor(rng() * catDef.products.length)];
    type = AD_TYPES[Math.floor(rng() * AD_TYPES.length)];
    name = `${brand}${product} ${type}`;
  } while (seen.has(name));
  seen.add(name);
  const s = CAT_STATS.ad;
  return {
    id: `ad${String(i + 1).padStart(3, "0")}`,
    name,
    type,
    star,
    genre: catDef.genre,
    fameReq: FAME_REQ[star - 1],
    statReq: buildStatReq(rng, "ad", star),
    fame: jit(rng, Math.round(FAME_REW[star - 1] * 0.7)),
    pay: jit(rng, Math.round(PAY_BASE[star - 1] * s.payMul)),
    energy: ENERGY[star - 1] - 1,
    days: 1,
    grow: buildGrow(rng, "ad", star),
    note: `${catDef.genre}品牌「${brand}」的${type}，${star >= 4 ? "年度代言级别的资源，身价的象征" : "出镜利落、来钱稳当的商务通告"}。`,
  };
}

function makeShow(i: number, rng: () => number, cat: "tv" | "film"): Gig {
  const star = starOf(i);
  const title = cat === "tv" ? DRAMA_TITLES[i] : DRAMA_TITLES[100 + i];
  const genre = (cat === "tv" ? TV_GENRES : FILM_GENRES)[Math.floor(rng() * (cat === "tv" ? TV_GENRES : FILM_GENRES).length)];
  const { cast, role } = makeCast(rng, star);
  const kind = cat === "tv" ? "电视剧" : "电影";
  const type = `${kind}${role}`;
  const roleMul = role === "女主角" ? 1 : role === "重要配角" ? 0.7 : role === "女配角" ? 0.6 : 0.4;
  const s = CAT_STATS[cat];
  return {
    id: `${cat === "tv" ? "tv" : "fl"}${String(i + 1).padStart(3, "0")}`,
    name: `《${title}》· ${genre}${kind} · ${role}`,
    type,
    star,
    genre,
    role,
    cast,
    fameReq: Math.round(FAME_REQ[star - 1] * (role === "女主角" ? 1 : 0.8)),
    statReq: buildStatReq(rng, cat, star),
    fame: Math.max(4, jit(rng, Math.round(FAME_REW[star - 1] * roleMul))),
    pay: jit(rng, Math.round(PAY_BASE[star - 1] * s.payMul * roleMul)),
    energy: ENERGY[star - 1],
    days: DAYS[star - 1],
    grow: buildGrow(rng, cat, star),
    note: `${genre}${kind}《${title}》，出演${role}。男主 ${cast.maleLead} × 女主 ${cast.femaleLead}，男配 ${cast.maleSupport}、女配 ${cast.femaleSupport}。`,
  };
}

function makeRecord(i: number, rng: () => number): Gig {
  const star = starOf(i);
  const title = RECORD_TITLES[100 + i]; // 与剧名池切片错开，且与影视不撞
  const genre = REC_GENRES[Math.floor(rng() * REC_GENRES.length)];
  const type = REC_TYPES[Math.floor(rng() * REC_TYPES.length)];
  const s = CAT_STATS.record;
  return {
    id: `rec${String(i + 1).padStart(3, "0")}`,
    name: `《${title}》· ${genre} · ${type}`,
    type,
    star,
    genre,
    fameReq: FAME_REQ[star - 1],
    statReq: buildStatReq(rng, "record", star),
    fame: jit(rng, FAME_REW[star - 1]),
    pay: jit(rng, Math.round(PAY_BASE[star - 1] * s.payMul)),
    energy: ENERGY[star - 1],
    days: DAYS[star - 1],
    grow: buildGrow(rng, "record", star),
    note: `${genre}曲风的${type}《${title}》，${star >= 4 ? "从选曲到打歌都是硬仗，唱功与舞台缺一不可" : "跟唱跟跳攒粉丝的好机会"}。`,
  };
}

function build(): Gig[] {
  const out: Gig[] = [];
  const rAd = mulberry32(101);
  const rTv = mulberry32(202);
  const rFl = mulberry32(303);
  const rRec = mulberry32(404);
  const adSeen = new Set<string>();
  for (let i = 0; i < 100; i++) out.push(makeAd(i, rAd, adSeen));
  for (let i = 0; i < 100; i++) out.push(makeShow(i, rTv, "tv"));
  for (let i = 0; i < 100; i++) out.push(makeShow(i, rFl, "film"));
  for (let i = 0; i < 100; i++) out.push(makeRecord(i, rRec));
  return out;
}

function buildWith(t: GigPriceTable): Gig[] {
  const ok = (a: number[] | undefined, d: number[]) => (Array.isArray(a) && a.length >= 5 && a.every((x) => Number.isFinite(x)) ? a : d);
  FAME_REQ = ok(t.fameReq, DEFAULT_GIG_PRICES.fameReq);
  PAY_BASE = ok(t.payBase, DEFAULT_GIG_PRICES.payBase);
  FAME_REW = ok(t.fameReward, DEFAULT_GIG_PRICES.fameReward);
  DAYS = ok(t.days, DEFAULT_GIG_PRICES.days);
  ENERGY = ok(t.energy, DEFAULT_GIG_PRICES.energy);
  try { return build(); } finally {
    FAME_REQ = DEFAULT_GIG_PRICES.fameReq; PAY_BASE = DEFAULT_GIG_PRICES.payBase; FAME_REW = DEFAULT_GIG_PRICES.fameReward;
    DAYS = DEFAULT_GIG_PRICES.days; ENERGY = DEFAULT_GIG_PRICES.energy;
  }
}

export const GENERATED_GIGS: Gig[] = build();
const GENERATED_IDS = new Set(GENERATED_GIGS.map((g) => g.id));

/* 按世界价目表重算通告库：只替换库内生成的通告（同 id），其余手写通告原样保留 */
const priced = new WeakMap<GigPriceTable, Map<string, Gig>>();
export function applyGigPrices(gigs: Gig[], table: GigPriceTable | undefined): Gig[] {
  if (!table || table === DEFAULT_GIG_PRICES) return gigs;
  let m = priced.get(table);
  if (!m) { m = new Map(buildWith(table).map((g) => [g.id, g])); priced.set(table, m); }
  return gigs.map((g) => (GENERATED_IDS.has(g.id) ? m!.get(g.id) ?? g : g));
}
