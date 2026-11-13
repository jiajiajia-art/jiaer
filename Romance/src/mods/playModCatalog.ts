/**
 * 玩法组件目录：只含玩法 Mod（P3）；手机应用（论坛 / 视频·直播 / 咸鱼等）归应用商店，不进「添加玩法」与推荐。
 * 远程上架包若带 phone_app 类型，仅用于识别安装记录，本地种子目录不再内置应用项。
 * 玩法 Mod = 创作者给某一剧本加的可选玩法（孕育 / 出行 / 座驾 / 通告事业等），用「添加玩法」启用。
 * 禁止把娱乐圈骨架、校园骨架等世界观底子放进本目录；那些不是创作者要勾的玩法。
 * 头衔是可选玩法（pack-titles）：需要的剧本才添加，未添加不显示配置区。
 * 关系玩法（pack-relations）：表白 / 婚礼 / 牵线 / 伴侣加成；未添加不显示配置与人物页表白婚礼入口。
 * 存档结构、登录、档案、人脉、设置 = 游戏本体功能，不进本目录；基础设定、建角、地点、人物、事件也在编辑器其它页直接配。
 * 本目录不是游戏本体；本体功能不进本目录。
 * 编辑器按「已安装组件」动态显示配置，不再硬编码通告/孕育/座驾等入口。
 * C0.3：官方包带适用题材语义 code，由题材 API 解析成 id。
 */
import {
  OFFICIAL_PLAY_MOD_THEME_CODES,
  type ThemeApplicabilityCode,
} from "../lib/officialThemeApplicability.ts";

export type ComponentKind = "gameplay" | "phone_app";

export type PlayModEditorPanelId =
  | "gigs"
  | "contracts"
  | "projects"
  | "industry"
  | "imageCrisis"
  | "weeklyPaper"
  | "meals"
  | "pregnancy"
  | "travel"
  | "cars"
  | "titles"
  | "relations"
  | "factionRep"
  | "phoneApp";

export type PlayModInstallConfig = {
  modId: string;
  slug: string;
  versionPinned: string;
  /** 功能注释：P2 本世界安装这包的日期（ISO）；旧记录可缺省 */
  installedAt?: string;
  enabled: boolean;
  navLabel?: string;
  iconSvg?: string;
  visible?: boolean;
  sortOrder?: number;
  openParams?: Record<string, unknown>;
  editorPanels: PlayModEditorPanelId[];
  componentKind?: ComponentKind;
  phoneAppId?: string;
  dependsOn?: string[];
  /**
   * 功能注释：因其它玩法依赖链由系统一并装入。
   * 取消主玩法时可提示卸掉无人再需要的自动依赖；无此标记视为作者手动装入，禁止静默删除。
   */
  autoInstalled?: boolean;
};

export type LocalPlayModCatalogItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceKk: number;
  version: string;
  defaultNavLabel: string;
  needsNavEntry: boolean;
  editorPanels: PlayModEditorPanelId[];
  iconSvg: string;
  romanceAddonId?: string;
  componentKind: ComponentKind;
  phoneAppId?: string;
  dependsOn?: string[];
  /** 功能注释：商店详情 — 作者展示名（创作者上传必填侧同步） */
  authorName: string;
  /** 功能注释：互斥玩法 slug（双向生效）；平台 SDK 兼容区间 */
  conflictsWith?: string[];
  compatMin?: string;
  compatMax?: string;
  /** 功能注释：商店详情 — 下载量（stats.installGames 前端展示） */
  downloadCount: number;
  /** 功能注释：商店详情 — 完整玩法说明（上传必填） */
  detailDescription: string;
  /** 功能注释：商店详情 — 作者上传的预览图 URL（上架至少 1 张） */
  previewImages: string[];
  /** 功能注释：适用题材语义 code（C0.3）；前台解析成 applicableThemeTagIds */
  applicableThemeCodes: ThemeApplicabilityCode[];
  /** 功能注释：后台已解析的适用题材 id（有则安装提示优先用 id 精确比对） */
  applicableThemeTagIds?: number[] | null;
};

/** 功能注释：给官方种子补齐商店详情字段，与后端上架契约对齐 */
function withStoreDetail(
  item: Omit<LocalPlayModCatalogItem, "authorName" | "downloadCount" | "detailDescription" | "previewImages" | "applicableThemeCodes">,
  detail: { downloads: number; detail: string },
): LocalPlayModCatalogItem {
  const codes = OFFICIAL_PLAY_MOD_THEME_CODES[item.slug];
  return {
    ...item,
    authorName: "官方",
    downloadCount: detail.downloads,
    detailDescription: detail.detail,
    // 功能注释：预览图必须由作者上传，本地种子不造占位图
    previewImages: [],
    // 功能注释：官方包必须有至少 1 个适用题材语义；缺配置时按 modern 兜底并便于单测抓住遗漏
    applicableThemeCodes: codes?.length ? [...codes] : ["modern"],
  };
}

const ICON = (d: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">${d}</svg>`;

/** 功能注释：官方玩法种子（与后端 OFFICIAL_PLAY_MOD_SEEDS / entPacks 对齐） */
export const LOCAL_PLAY_MOD_CATALOG: LocalPlayModCatalogItem[] = [
  withStoreDetail(
    {
      id: "pm-pack-career",
      slug: "pack-career",
      name: "事业经营包",
      description: "接单、签约、项目与行业生态（叫法与分类可改）",
      priceKk: 0,
      version: "1.0.0",
      defaultNavLabel: "事业",
      needsNavEntry: true,
      editorPanels: ["gigs", "contracts", "projects", "industry"],
      iconSvg: ICON('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 20h8M12 4v4"/>'),
      romanceAddonId: "pack-career",
      componentKind: "gameplay",
    },
    {
      downloads: 4820,
      detail:
        "事业经营包为剧本增加接单、合约谈判、长期项目与行业生态，适用任何题材：在编辑器里把通告、艺人、经纪公司改成委托、弟子、门派等叫法，分类与阵容角色也能自定义。可选挂「事业」底栏页，不改动档案、人脉、登录与存档结构。",
    },
  ),
  withStoreDetail(
    {
      id: "pm-pack-image",
      slug: "pack-image",
      name: "声誉舆情包",
      description: "公众形象经营与声誉危机",
      priceKk: 0,
      version: "1.0.0",
      defaultNavLabel: "形象",
      needsNavEntry: true,
      editorPanels: ["imageCrisis"],
      iconSvg: ICON('<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 6-5 8-5s6.5 1 8 5"/>'),
      romanceAddonId: "pack-image",
      componentKind: "gameplay",
    },
    {
      downloads: 3100,
      detail:
        "声誉舆情包提供公众形象经营与声誉危机事件：流言、对立者与公关抉择，关注者、口碑等叫法跟随「玩法叫法」。作者可改触发与字段结算，可选挂「形象」底栏。",
    },
  ),
  withStoreDetail(
    {
      id: "pm-pack-paper",
      slug: "pack-paper",
      name: "周报包",
      description: "每周小报",
      priceKk: 0,
      version: "1.0.0",
      defaultNavLabel: "",
      needsNavEntry: false,
      editorPanels: ["weeklyPaper"],
      iconSvg: ICON('<path d="M4 5h12a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2V5z"/><path d="M8 9h8M8 13h6"/>'),
      romanceAddonId: "pack-paper",
      componentKind: "gameplay",
    },
    {
      downloads: 1980,
      detail: "周报包按周汇总热点、榜单与作品内动向，作为可选玩法面板；默认不占底栏，需要时可自行挂载。",
    },
  ),
  withStoreDetail(
    {
      id: "pm-pack-transport",
      slug: "pack-transport",
      name: "出行与交通",
      description: "内置交通系统：出行方式、花费、选择区文案；未安装时点哪去哪",
      priceKk: 0,
      version: "1.0.0",
      defaultNavLabel: "",
      needsNavEntry: false,
      editorPanels: ["travel"],
      iconSvg: ICON('<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
      romanceAddonId: "pack-transport",
      componentKind: "gameplay",
    },
    {
      downloads: 2650,
      detail:
        "出行与交通是可选玩法：提供出行方式、花费与选择区文案。未安装时仍可点哪去哪。属于剧本加料，不是建角/时间推进本体。",
    },
  ),
  withStoreDetail(
    {
      id: "pm-pack-cars",
      slug: "pack-cars",
      name: "座驾包",
      description: "购车与切换座驾（建议先装出行与交通）",
      priceKk: 0,
      version: "1.0.0",
      defaultNavLabel: "",
      needsNavEntry: false,
      editorPanels: ["cars"],
      iconSvg: ICON('<path d="M5 14h14l-1.5-5.5A2 2 0 0 0 15.6 7H8.4a2 2 0 0 0-1.9 1.5L5 14z"/><circle cx="8" cy="16" r="1.5"/><circle cx="16" cy="16" r="1.5"/>'),
      romanceAddonId: "pack-cars",
      componentKind: "gameplay",
      dependsOn: ["pack-transport"],
    },
    {
      downloads: 1520,
      detail:
        "座驾包支持购车与切换座驾，依赖「出行与交通」。添加时会提示一并安装依赖。不占用档案/人脉等本体入口。",
    },
  ),
  withStoreDetail(
    {
      id: "pm-pack-pregnancy",
      slug: "pack-pregnancy",
      name: "孕育包",
      description: "孕期与分娩玩法",
      priceKk: 0,
      version: "1.0.0",
      defaultNavLabel: "",
      needsNavEntry: false,
      editorPanels: ["pregnancy"],
      iconSvg: ICON('<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>'),
      romanceAddonId: "pack-pregnancy",
      componentKind: "gameplay",
    },
    {
      downloads: 2210,
      detail:
        "孕育包为可选恋爱向玩法：征兆、孕期与分娩随日程推进。触发与字段结算可在编辑器内调整；不属于本体档案功能。",
    },
  ),
  withStoreDetail(
    {
      id: "pm-pack-living",
      slug: "pack-living",
      name: "生活开销包",
      description: "每周吃什么与住行账单",
      priceKk: 0,
      version: "1.0.0",
      defaultNavLabel: "",
      needsNavEntry: false,
      editorPanels: ["meals"],
      iconSvg: ICON('<path d="M4 11h16v8H4z"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
      romanceAddonId: "pack-living",
      componentKind: "gameplay",
    },
    {
      downloads: 1740,
      detail: "生活开销包提供每周伙食与住行账单玩法；伙食档位、花费与属性影响按本作品建角属性填写，不带入娱乐圈数值。",
    },
  ),
  withStoreDetail(
    {
      id: "pm-pack-titles",
      slug: "pack-titles",
      name: "头衔包",
      description: "达标即获得的头衔表；条件可用名气 / 口碑 / 能力 / 自定义属性",
      priceKk: 0,
      version: "1.0.0",
      defaultNavLabel: "",
      needsNavEntry: false,
      editorPanels: ["titles"],
      iconSvg: ICON('<path d="M12 3l2.2 4.5L19 8.2l-3.5 3.4.8 4.9L12 14.8 7.7 16.5l.8-4.9L5 8.2l4.8-.7L12 3z"/>'),
      romanceAddonId: "pack-titles",
      componentKind: "gameplay",
    },
    {
      downloads: 1680,
      detail:
        "头衔包为可选玩法：作者自填头衔名、品阶与达标条件。未添加的剧本不出现头衔配置与开局头衔表；数值分档请在建角属性里配，不要与头衔混用。",
    },
  ),
  withStoreDetail(
    {
      id: "pm-pack-relations",
      slug: "pack-relations",
      name: "关系玩法",
      description: "表白门槛、婚礼费用与好感、NPC 牵线、伴侣加成",
      priceKk: 0,
      version: "1.0.0",
      defaultNavLabel: "",
      needsNavEntry: false,
      editorPanels: ["relations"],
      iconSvg: ICON('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>'),
      romanceAddonId: "pack-relations",
      componentKind: "gameplay",
    },
    {
      downloads: 2560,
      detail:
        "关系玩法为可选恋爱向组件：表白门槛、婚礼费用与好感、NPC 牵线开关、伴侣加成。从商店加进作品后才出现配置区，人物页才显示表白与婚礼入口；未添加的剧本不出现整块关系玩法。",
    },
  ),
  withStoreDetail(
    {
      id: "pm-pack-faction-rep",
      slug: "pack-faction-rep",
      name: "阵营声望",
      description: "势力声望、建角加入势力、按声望调价、好感外溢",
      priceKk: 0,
      version: "1.0.0",
      defaultNavLabel: "",
      needsNavEntry: false,
      editorPanels: ["factionRep"],
      iconSvg: ICON('<path d="M4 21V4"/><path d="M4 4h12l-2 4 2 4H4"/>'),
      romanceAddonId: "pack-faction-rep",
      componentKind: "gameplay",
    },
    {
      downloads: 1880,
      detail:
        "阵营声望为作品里的势力加上经营数值：主角在每个势力有 -100~100 的声望，建角时可选择加入势力并获得初始声望，在势力控制的地点购物按声望打折或加价，对势力成员的好感变化会外溢到声望；事件可按声望触发、改变声望。未添加时势力只作设定与人物归属，不出现任何声望数值。",
    },
  ),
];
/**
 * 功能注释：玩家菜单「玩法 Mod」入口（支票/账单）是否展示。
 * 仅当作品装了演艺事业（通告支票）或生活开销（账单槽）等对应玩法时出现；都没选则菜单里也不出现。
 */
export function shouldShowPlayModMenuEntry(careerOn: boolean, billsSlotOn: boolean): boolean {
  return careerOn || billsSlotOn;
}

/** 功能注释：汇总已安装且启用的编辑面板；未装任何玩法 Mod 时不展示硬编码玩法块 */
export function resolveInstalledEditorPanels(installs: PlayModInstallConfig[] | undefined): Set<PlayModEditorPanelId> {
  const set = new Set<PlayModEditorPanelId>();
  const list = Array.isArray(installs) ? installs : [];
  for (const inst of list) {
    if (!inst || typeof inst !== "object" || inst.enabled === false) continue;
    const panels = Array.isArray(inst.editorPanels) ? inst.editorPanels : [];
    for (const p of panels) set.add(p);
  }
  return set;
}

/**
 * 功能注释：按故事设定关键词推荐可选玩法/手机组件（仅建议，绝不自动安装）。
 * 作者须在「玩法 mod」区确认后才会写入 playModInstalls。
 */
export function recommendPlayModsFromSetting(
  setting: string,
  installs: PlayModInstallConfig[] | undefined = [],
): LocalPlayModCatalogItem[] {
  const text = String(setting || "");
  const list = Array.isArray(installs) ? installs : [];
  const installed = new Set(list.flatMap((x) => [x.slug, x.modId].filter(Boolean)));
  const hits: LocalPlayModCatalogItem[] = [];
  const add = (slug: string) => {
    const item = LOCAL_PLAY_MOD_CATALOG.find((x) => x.slug === slug);
    if (!item) return;
    if (installed.has(item.slug) || installed.has(item.id) || (item.romanceAddonId && installed.has(item.romanceAddonId))) {
      return;
    }
    if (!hits.some((h) => h.id === item.id)) hits.push(item);
  };

  if (/娱乐|明星|经纪人|通告|影视|综艺|偶像|演艺|出道|片场|经纪/.test(text)) {
    add("pack-career");
    add("pack-image");
    add("pack-paper");
  }
  if (/怀孕|孕育|结婚|生育|孩子|孕期/.test(text)) add("pack-pregnancy");
  if (/交通|出行|公交|地铁|打车|车费|怎么去/.test(text)) add("pack-transport");
  if (/座驾|购车|开车|跑车|豪车/.test(text)) {
    add("pack-transport");
    add("pack-cars");
  }
  if (/吃饭|伙食|生活开销|房租|账单|租房/.test(text)) add("pack-living");
  if (/头衔|称号|成就称号|佩戴头衔/.test(text)) add("pack-titles");
  if (/表白|婚礼|恋爱|结婚|伴侣|牵线|好感门槛|关系玩法/.test(text)) add("pack-relations");
  if (/帮派|门派|宗门|阵营|派系|宫斗|站队|声望|势力/.test(text)) add("pack-faction-rep");

  return hits.slice(0, 6);
}

export function catalogBySlug(slug: string) {
  return LOCAL_PLAY_MOD_CATALOG.find((x) => x.slug === slug || x.id === slug || x.romanceAddonId === slug);
}

/** 功能注释：从目录项生成作品内独立安装配置（互不覆盖） */
export function makeInstallFromCatalog(item: LocalPlayModCatalogItem, sortOrder = 0): PlayModInstallConfig {
  return {
    modId: item.id,
    slug: item.slug,
    versionPinned: item.version,
    installedAt: new Date().toISOString(),
    enabled: true,
    navLabel: item.defaultNavLabel || undefined,
    iconSvg: item.iconSvg || undefined,
    visible: true,
    sortOrder,
    openParams: {},
    editorPanels: [...item.editorPanels],
    componentKind: item.componentKind,
    phoneAppId: item.phoneAppId,
    dependsOn: item.dependsOn ? [...item.dependsOn] : undefined,
  };
}

/** 功能注释：玩法 slug → 运行时 FeatureFlags；列表里有就等于开，去掉就等于关（不再另做功能开关） */
export const PLAY_MOD_FEATURE_BY_SLUG = Object.freeze({
  "pack-career": Object.freeze(["career", "industryTab"] as const),
  "pack-image": Object.freeze(["imageCrisis"] as const),
  "pack-paper": Object.freeze(["weeklyPaper"] as const),
  "pack-pregnancy": Object.freeze(["pregnancy"] as const),
  "pack-transport": Object.freeze(["transport"] as const),
  "pack-cars": Object.freeze(["cars"] as const),
  "pack-relations": Object.freeze(["relationsPlay"] as const),
  "pack-faction-rep": Object.freeze(["factionRep"] as const),
});

type PlayModFeatureKey = (typeof PLAY_MOD_FEATURE_BY_SLUG)[keyof typeof PLAY_MOD_FEATURE_BY_SLUG][number];

/** 功能注释：已安装且未显式关闭的玩法 slug 集合（含 romanceAddonId 别名） */
export function installedPlayModSlugSet(installs: PlayModInstallConfig[] | undefined): Set<string> {
  const set = new Set<string>();
  for (const inst of Array.isArray(installs) ? installs : []) {
    if (!inst || typeof inst !== "object" || inst.enabled === false) continue;
    if (inst.slug) set.add(inst.slug);
    if (inst.modId) set.add(inst.modId);
    const cat = catalogBySlug(inst.slug || inst.modId || "");
    if (cat?.slug) set.add(cat.slug);
    if (cat?.id) set.add(cat.id);
    if (cat?.romanceAddonId) set.add(cat.romanceAddonId);
  }
  return set;
}

/**
 * 功能注释：由「已添加的玩法」推导 features。
 * 手机相关键（phone / phoneApps*）不由玩法列表改写；其余映射键一律以列表为准。
 */
export function syncFeaturesFromPlayModInstalls(
  installs: PlayModInstallConfig[] | undefined,
  prev?: Record<string, unknown> | null,
): Record<string, unknown> {
  const base = prev && typeof prev === "object" && !Array.isArray(prev) ? { ...prev } : {};
  const have = installedPlayModSlugSet(installs);
  const mapped = new Set<PlayModFeatureKey>();
  for (const keys of Object.values(PLAY_MOD_FEATURE_BY_SLUG)) {
    for (const k of keys) mapped.add(k);
  }
  for (const k of mapped) delete base[k];
  for (const [slug, keys] of Object.entries(PLAY_MOD_FEATURE_BY_SLUG)) {
    if (!have.has(slug)) continue;
    for (const k of keys) base[k] = true;
  }
  // 功能注释：未安装的映射键显式 false，避免旧默认「未声明=开」把已卸玩法又打开
  for (const k of mapped) {
    if (base[k] !== true) base[k] = false;
  }
  return base;
}

/** 功能注释：已安装且启用的手机应用 id，供 PhoneAppsEditor / 运行时动态合并 */
export function resolveInstalledPhoneAppIds(installs: PlayModInstallConfig[] | undefined): string[] {
  const ids: string[] = [];
  for (const inst of installs || []) {
    if (inst.enabled === false) continue;
    const appId = inst.phoneAppId || catalogBySlug(inst.slug)?.phoneAppId;
    if (appId) ids.push(appId);
  }
  return Array.from(new Set(ids));
}

/** 功能注释：娱乐圈内置世界 id；只有它才会自动补娱乐圈原版玩法扩展包 */
export const ENT_WORLD_ID = "ent";

/**
 * 功能注释：是否对该世界自动补娱乐圈拆包（ENT_PACK_IDS）。
 * 只对内置娱乐圈（或缺省世界 id 的旧存档）为 true；创作者世界一律 false，玩法只认 playModInstalls。
 */
export function shouldAutoAttachEntPacks(worldId: string | undefined | null): boolean {
  const id = String(worldId ?? "").trim();
  return !id || id === ENT_WORLD_ID;
}

/**
 * 功能注释：把世界的 playModInstalls 映射成运行时要叠加的叠加包 modId（P1）。
 * - 只认已启用（enabled !== false）的玩法记录，手机应用类（phone_app）不进叠加链
 * - 候选 id 依次为目录 romanceAddonId / 记录 slug / 记录 modId，取第一个 isAddonAvailable 为真的
 * - 结果去重并保持安装顺序；装了但本机没有对应叠加包的记录会被跳过（不报错）
 */
export function resolveInstallAddonModIds(
  installs: PlayModInstallConfig[] | undefined,
  isAddonAvailable: (modId: string) => boolean,
): string[] {
  const out: string[] = [];
  for (const inst of Array.isArray(installs) ? installs : []) {
    if (!inst || typeof inst !== "object" || inst.enabled === false) continue;
    const cat = catalogBySlug(inst.slug) ?? catalogBySlug(inst.modId);
    if (inst.componentKind === "phone_app" || cat?.componentKind === "phone_app") continue;
    const candidates = [cat?.romanceAddonId, inst.slug, inst.modId].filter(
      (x): x is string => typeof x === "string" && x.trim() !== "",
    );
    const hit = candidates.find((id) => isAddonAvailable(id));
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

/** 功能注释：安装前本地依赖检查（返回缺失的 slug） */
export function checkLocalInstallDeps(item: LocalPlayModCatalogItem, installs: PlayModInstallConfig[]): string[] {
  const have = new Set(installs.filter((x) => x.enabled !== false).flatMap((x) => [x.slug, x.modId]));
  const missing: string[] = [];
  for (const d of item.dependsOn || []) {
    if (!have.has(d)) missing.push(d);
  }
  return missing;
}

/**
 * 功能注释：把缺失依赖解析成创作者可读名称（如「出行与交通」），供确认弹窗文案。
 */
export function missingPlayModDepNames(
  item: LocalPlayModCatalogItem,
  installs: PlayModInstallConfig[],
  /** 功能注释：商店传入接口数据的查找函数；缺省用本地目录 */
  lookup: (slug: string) => LocalPlayModCatalogItem | undefined = catalogBySlug,
): string[] {
  return checkLocalInstallDeps(item, installs).map((slug) => lookup(slug)?.name || slug);
}

/**
 * 功能注释：按依赖顺序生成待安装目录项（依赖在前、目标在后；已安装的跳过）。
 * 系统代劳依赖解析，创作者只需确认「是否一并添加」。
 */
export function resolvePlayModInstallChain(
  item: LocalPlayModCatalogItem,
  installs: PlayModInstallConfig[],
  lookup: (slug: string) => LocalPlayModCatalogItem | undefined = catalogBySlug,
): LocalPlayModCatalogItem[] {
  const installed = new Set(installs.map((x) => x.slug));
  const chain: LocalPlayModCatalogItem[] = [];
  const seen = new Set<string>();
  const walk = (node: LocalPlayModCatalogItem) => {
    if (seen.has(node.slug) || installed.has(node.slug)) return;
    seen.add(node.slug);
    for (const depSlug of node.dependsOn || []) {
      const dep = lookup(depSlug);
      if (dep) walk(dep);
    }
    if (!installed.has(node.slug)) chain.push(node);
  };
  walk(item);
  return chain;
}

/** 功能注释：作者开放配置白名单 —— 禁止改底层规则字段 */
export function pickPlayModOpenConfig(
  input: Partial<PlayModInstallConfig>,
  allowed: string[] = ["enabled", "navLabel", "iconSvg", "visible", "sortOrder"],
): Partial<PlayModInstallConfig> {
  const allow = new Set(allowed);
  const out: Partial<PlayModInstallConfig> = {};
  if (allow.has("enabled") && input.enabled !== undefined) out.enabled = !!input.enabled;
  if (allow.has("navLabel") && input.navLabel !== undefined) out.navLabel = String(input.navLabel).slice(0, 40);
  if (allow.has("iconSvg") && input.iconSvg !== undefined) out.iconSvg = String(input.iconSvg).slice(0, 20_000);
  if (allow.has("visible") && input.visible !== undefined) out.visible = !!input.visible;
  if (allow.has("sortOrder") && input.sortOrder !== undefined) {
    const n = Math.trunc(Number(input.sortOrder));
    out.sortOrder = Number.isFinite(n) ? n : 0;
  }
  return out;
}
