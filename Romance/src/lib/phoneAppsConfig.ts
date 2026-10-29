/**
 * 手机应用配置契约：模组声明每个应用的名称 / 图标 / 顺序 / 是否开局预装。
 * 与 features.phoneApps 白名单并存——旧模组只写白名单仍可读；新配置优先。
 *
 * 作者侧只有二元：开局预装 ↔ 商店可下。locked/hidden/disabled 仅兼容旧 JSON，
 * 读取时归一为 store（不预装、商店可下），不再提供独立编辑入口。
 */
export type PhoneAppAvail = "preinstall" | "store" | "locked" | "hidden" | "disabled";

/** 功能注释：运行时 / 编辑器只认预装与商店；旧状态一律落到商店可下 */
export type PhoneAppAvailSimple = "preinstall" | "store";

export type PhoneAppDef = {
  id: string;
  /** 桌面与商店显示名；缺省用引擎内置名 */
  label?: string;
  /** 自定义图标 URL / dataURL；缺省用内置 SVG */
  icon?: string;
  /** 桌面排序（越小越靠前）；缺省按内置顺序 */
  order?: number;
  /**
   * preinstall=新开局桌面已装；其它（含旧 locked/hidden/disabled）= 开局不装、商店可下。
   * 只影响新开局默认已装列表，不卸载已有存档里已安装的应用。
   */
  avail?: PhoneAppAvail;
  /** 旧「条件解锁」文案；新 UI 不再编辑，读取时保留以免丢字段 */
  unlockHint?: string;
};

/** 功能注释：把旧五态收成预装 / 商店，供解析与写入 */
export function normalizePhoneAppAvail(avail?: PhoneAppAvail | null): PhoneAppAvailSimple {
  return avail === "preinstall" ? "preinstall" : "store";
}

/** 引擎内置应用目录（与 Phone.tsx CORE+STORE 对齐的可配置子集；不含纯小组件） */
export type PhoneAppCatalogItem = {
  id: string;
  label: string;
  kind: "core" | "store";
  /** 未写 avail 时的默认：core 预装（个别除外），store 商店可下 */
  defaultAvail: PhoneAppAvailSimple;
  blurb: string;
  emptyHint: string;
  entries: string[];
};

export const PHONE_APP_CATALOG: readonly PhoneAppCatalogItem[] = Object.freeze([
  { id: "wechat", label: "绿信", kind: "core", defaultAvail: "preinstall", blurb: "聊天、朋友圈、钱包", emptyHint: "还没有会话，去人脉里结识朋友吧", entries: ["会话列表", "朋友圈", "钱包"] },
  { id: "sms", label: "信息", kind: "core", defaultAvail: "preinstall", blurb: "短信与通知", emptyHint: "收件箱是空的", entries: ["收件箱", "服务号"] },
  { id: "call", label: "电话", kind: "core", defaultAvail: "preinstall", blurb: "通话记录与拨号", emptyHint: "暂无通话记录", entries: ["最近通话", "拨号盘"] },
  { id: "mail", label: "邮箱", kind: "core", defaultAvail: "preinstall", blurb: "来信与回信", emptyHint: "没有未读邮件", entries: ["收件箱", "写邮件"] },
  { id: "weibo", label: "冲浪", kind: "core", defaultAvail: "preinstall", blurb: "热搜与博文", emptyHint: "热搜还在刷新…", entries: ["热搜", "关注", "我的"] },
  { id: "xhs", label: "小粉书", kind: "core", defaultAvail: "preinstall", blurb: "种草笔记", emptyHint: "还没有笔记", entries: ["发现", "关注", "消息"] },
  { id: "ticket", label: "票团团", kind: "core", defaultAvail: "preinstall", blurb: "演出购票", emptyHint: "近期没有场次", entries: ["演出", "票夹"] },
  { id: "cloudmusic", label: "云音乐", kind: "core", defaultAvail: "preinstall", blurb: "歌单与歌词", emptyHint: "还没有在播曲目", entries: ["推荐", "歌单", "搜索"] },
  { id: "read", label: "阅读", kind: "core", defaultAvail: "preinstall", blurb: "小说与连载", emptyHint: "书架空空的", entries: ["书城", "书架"] },
  { id: "video", label: "视频", kind: "core", defaultAvail: "preinstall", blurb: "视频与直播", emptyHint: "还没有推荐", entries: ["推荐", "直播", "关注"] },
  { id: "bosspin", label: "老板直聘", kind: "core", defaultAvail: "preinstall", blurb: "试镜与招募", emptyHint: "暂无职位", entries: ["职位", "消息", "我的"] },
  { id: "xianyu", label: "咸鱼", kind: "core", defaultAvail: "store", blurb: "二手闲置", emptyHint: "还没有闲置", entries: ["首页", "卖闲置", "消息"] },
  { id: "peek", label: "视监", kind: "core", defaultAvail: "preinstall", blurb: "偷看 TA 的手机", emptyHint: "先选一个对象", entries: ["选人", "聊天", "相册"] },
  { id: "couple", label: "情侣空间", kind: "core", defaultAvail: "preinstall", blurb: "二人世界", emptyHint: "还没有绑定对象", entries: ["空间", "信件", "纪念日"] },
  { id: "appstore", label: "应用商店", kind: "core", defaultAvail: "preinstall", blurb: "获取更多应用", emptyHint: "商店暂无上架", entries: ["精选", "应用", "已装"] },
  { id: "settings", label: "设置", kind: "core", defaultAvail: "preinstall", blurb: "壁纸与机身", emptyHint: "", entries: ["壁纸", "机身外壳", "通用"] },
  { id: "pomodoro", label: "番茄钟", kind: "store", defaultAvail: "store", blurb: "专注 25 分钟", emptyHint: "开始一颗番茄吧", entries: ["计时", "记录"] },
  { id: "clock", label: "时钟闹钟", kind: "store", defaultAvail: "store", blurb: "表盘与闹钟", emptyHint: "还没有闹钟", entries: ["时钟", "闹钟"] },
  { id: "notes", label: "备忘录", kind: "store", defaultAvail: "store", blurb: "随手记", emptyHint: "写下一句灵感", entries: ["全部笔记", "新建"] },
  { id: "calculator", label: "计算器", kind: "store", defaultAvail: "store", blurb: "四则运算", emptyHint: "", entries: ["标准计算"] },
  { id: "weather", label: "天气", kind: "store", defaultAvail: "store", blurb: "今日与一周", emptyHint: "定位中…", entries: ["今日", "一周"] },
  { id: "forum", label: "星潮", kind: "store", defaultAvail: "store", blurb: "饭圈论坛", emptyHint: "还没有帖子", entries: ["热帖", "板块", "我的"] },
]);

const byId = new Map(PHONE_APP_CATALOG.map((a) => [a.id, a]));

export function catalogItem(id: string): PhoneAppCatalogItem | undefined {
  return byId.get(id);
}

export type ResolvedPhoneApp = {
  id: string;
  label: string;
  icon?: string;
  order: number;
  /** 归一后仅 preinstall | store */
  avail: PhoneAppAvailSimple;
  unlockHint: string;
};

/** 合并模组覆盖与目录默认；旧 avail 在此归一，编辑器只看到预装 / 商店 */
/** 功能注释：AI 可能把 phoneAppsCfg 写成 {apps:[]}；非数组时按空覆盖，禁止 (x ?? []).map 崩页 */
function asPhoneOverrides(raw: unknown): PhoneAppDef[] {
  if (Array.isArray(raw)) return raw as PhoneAppDef[];
  if (raw && typeof raw === "object") {
    const bag = raw as Record<string, unknown>;
    for (const k of ["apps", "items", "list", "overrides"]) {
      if (Array.isArray(bag[k])) return bag[k] as PhoneAppDef[];
    }
  }
  return [];
}

export function resolvePhoneApps(overrides?: PhoneAppDef[] | null): ResolvedPhoneApp[] {
  const map = new Map(asPhoneOverrides(overrides).map((o) => [o.id, o]));
  return PHONE_APP_CATALOG.map((c, i) => {
    const o = map.get(c.id);
    const rawAvail = o?.avail ?? c.defaultAvail;
    return {
      id: c.id,
      label: (typeof o?.label === "string" ? o.label.trim() : "") || c.label,
      icon: o?.icon,
      order: o?.order ?? i,
      avail: normalizePhoneAppAvail(rawAvail),
      unlockHint: o?.unlockHint ?? "",
    };
  }).sort((a, b) => a.order - b.order);
}

/** 开局应预装的应用 id（含强制保留的应用商店）；仅影响新开局，不改已有存档 installed */
export function preinstallIds(overrides?: PhoneAppDef[] | null): string[] {
  const ids = resolvePhoneApps(overrides)
    .filter((a) => a.avail === "preinstall" && a.id !== "appstore")
    .map((a) => a.id);
  return Array.from(new Set(["appstore", ...ids]));
}

/** 商店可见：预装（便于重装）+ 未预装均可下载 */
export function storeVisibleIds(overrides?: PhoneAppDef[] | null): string[] {
  return resolvePhoneApps(overrides).map((a) => a.id);
}

/**
 * 玩家侧是否允许出现该应用（桌面或商店）。
 * 功能注释：旧 hidden/disabled 已归一为商店可下，目录内与未知 id 一律可见（不因配置藏应用）。
 */
export function phoneAppVisible(_id: string, _overrides?: PhoneAppDef[] | null): boolean {
  return true;
}

export function phoneAppLabel(id: string, overrides?: PhoneAppDef[] | null, fallback?: string): string {
  const a = resolvePhoneApps(overrides).find((x) => x.id === id);
  return a?.label || fallback || catalogItem(id)?.label || id;
}

/**
 * 把编辑器里的完整列表压回「仅差异」写入模组，避免默认值污染 JSON。
 * 与目录完全一致的项不写出。
 */
export function compactPhoneApps(list: PhoneAppDef[]): PhoneAppDef[] | undefined {
  const out: PhoneAppDef[] = [];
  for (const a of list) {
    const c = catalogItem(a.id);
    if (!c) continue;
    const patch: PhoneAppDef = { id: a.id };
    const label = typeof a.label === "string" ? a.label.trim() : "";
    if (label && label !== c.label) patch.label = label;
    if (a.icon) patch.icon = a.icon;
    if (typeof a.order === "number" && a.order !== PHONE_APP_CATALOG.findIndex((x) => x.id === a.id)) patch.order = a.order;
    // 功能注释：只写出归一后的预装/商店；旧 locked 等经 resolve 后不会再写回五态
    const avail = normalizePhoneAppAvail(a.avail ?? c.defaultAvail);
    if (avail !== c.defaultAvail) patch.avail = avail;
    // 功能注释：保留旧 unlockHint，避免打开即丢字段；新 UI 不再新增
    const unlockHint = typeof a.unlockHint === "string" ? a.unlockHint.trim() : "";
    if (unlockHint) patch.unlockHint = unlockHint;
    if (Object.keys(patch).length > 1) out.push(patch);
  }
  return out.length ? out : undefined;
}
