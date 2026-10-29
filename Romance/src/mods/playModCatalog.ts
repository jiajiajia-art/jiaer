/**
 * 统一组件目录：玩法组件 + 手机应用组件。
 * 编辑器按「已安装组件」动态显示配置，不再硬编码通告/孕育/座驾/论坛/直播等入口。
 */

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
  | "phoneApp";

export type PlayModInstallConfig = {
  modId: string;
  slug: string;
  versionPinned: string;
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
};

const ICON = (d: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">${d}</svg>`;

/** 功能注释：官方玩法种子（与后端 OFFICIAL_PLAY_MOD_SEEDS / entPacks 对齐） */
export const LOCAL_PLAY_MOD_CATALOG: LocalPlayModCatalogItem[] = [
  {
    id: "pm-pack-career",
    slug: "pack-career",
    name: "演艺事业包",
    description: "通告、合约、影视项目与行业生态",
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
    id: "pm-pack-image",
    slug: "pack-image",
    name: "舆情人设包",
    description: "人设经营与舆情危机",
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
    id: "pm-pack-paper",
    slug: "pack-paper",
    name: "娱乐周报包",
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
    id: "pm-app-forum",
    slug: "app-forum",
    name: "星潮论坛",
    description: "饭圈论坛应用",
    priceKk: 0,
    version: "1.0.0",
    defaultNavLabel: "",
    needsNavEntry: false,
    editorPanels: ["phoneApp"],
    iconSvg: ICON('<path d="M4 6h16v10H8l-4 4V6z"/>'),
    componentKind: "phone_app",
    phoneAppId: "forum",
  },
  {
    id: "pm-app-video-live",
    slug: "app-video-live",
    name: "视频·直播",
    description: "短视频与直播（依赖演艺事业包）",
    priceKk: 0,
    version: "1.0.0",
    defaultNavLabel: "",
    needsNavEntry: false,
    editorPanels: ["phoneApp"],
    iconSvg: ICON('<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M10 10l5 2-5 2z"/>'),
    componentKind: "phone_app",
    phoneAppId: "video",
    dependsOn: ["pack-career"],
  },
  {
    id: "pm-app-xianyu",
    slug: "app-xianyu",
    name: "咸鱼闲置",
    description: "二手商城（依赖生活开销包）",
    priceKk: 0,
    version: "1.0.0",
    defaultNavLabel: "",
    needsNavEntry: false,
    editorPanels: ["phoneApp"],
    iconSvg: ICON('<path d="M4 8h16v10H4z"/><path d="M8 8V6h8v2"/>'),
    componentKind: "phone_app",
    phoneAppId: "xianyu",
    dependsOn: ["pack-living"],
  },
];
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
    add("app-forum");
    add("app-video-live");
  }
  if (/怀孕|孕育|结婚|生育|孩子|孕期/.test(text)) add("pack-pregnancy");
  if (/交通|出行|公交|地铁|打车|车费|怎么去/.test(text)) add("pack-transport");
  if (/座驾|购车|开车|跑车|豪车/.test(text)) {
    add("pack-transport");
    add("pack-cars");
  }
  if (/吃饭|伙食|生活开销|房租|账单|租房/.test(text)) add("pack-living");
  if (/直播|短视频|带货/.test(text)) add("app-video-live");
  if (/二手|闲置|咸鱼|商城/.test(text)) add("app-xianyu");

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
export function missingPlayModDepNames(item: LocalPlayModCatalogItem, installs: PlayModInstallConfig[]): string[] {
  return checkLocalInstallDeps(item, installs).map((slug) => catalogBySlug(slug)?.name || slug);
}

/**
 * 功能注释：按依赖顺序生成待安装目录项（依赖在前、目标在后；已安装的跳过）。
 * 系统代劳依赖解析，创作者只需确认「是否一并添加」。
 */
export function resolvePlayModInstallChain(
  item: LocalPlayModCatalogItem,
  installs: PlayModInstallConfig[],
): LocalPlayModCatalogItem[] {
  const installed = new Set(installs.map((x) => x.slug));
  const chain: LocalPlayModCatalogItem[] = [];
  const seen = new Set<string>();
  const walk = (node: LocalPlayModCatalogItem) => {
    if (seen.has(node.slug) || installed.has(node.slug)) return;
    seen.add(node.slug);
    for (const depSlug of node.dependsOn || []) {
      const dep = catalogBySlug(depSlug);
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
