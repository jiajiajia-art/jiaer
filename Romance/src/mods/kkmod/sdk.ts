/**
 * 组件开发 SDK（.kkmod）：受控事件 / 结算 / 界面 / 通知 / 作品级存档。
 * 禁止任意脚本、跨作品读档、账号隐私与绕过支付。
 */

export const KKMOD_ALLOWED_PERMISSIONS = [
  "event.emit",
  "event.on",
  "settle.apply",
  "ui.panel",
  "ui.toast",
  "notify.push",
  "save.game.read",
  "save.game.write",
  "nav.badge",
  "phone.openApp",
] as const;

export const KKMOD_FORBIDDEN_PERMISSIONS = [
  "script.eval",
  "script.arbitrary",
  "save.cross_game",
  "account.privacy",
  "pay.bypass",
  "fs.write",
  "net.fetch",
  "dom.inject",
] as const;

export type ComponentKind = "gameplay" | "phone_app";

export type KkmodManifest = {
  id: string;
  slug: string;
  name: string;
  version: string;
  kind: ComponentKind;
  description?: string;
  dependencies: Array<string | { id: string; minVersion?: string }>;
  permissions: string[];
  configSchema: Array<{ key: string; type: string; label?: string }>;
  saveMigrate: Array<{ from: string; to: string; note?: string }>;
  testCases: Array<{ id: string; name: string; expect?: string }>;
  editorPanels?: string[];
  phoneAppId?: string;
  compatMin?: string;
  compatMax?: string;
  conflictsWith?: string[];
  priceKk?: number;
  iconSvg?: string;
  navEntry?: { needed?: boolean; defaultLabel?: string };
};

export type KkmodPackage = {
  manifest: KkmodManifest;
  payload?: Record<string, unknown>;
};

/** 功能注释：宿主注入给组件的受控 API 形状（运行时由引擎实现，此处仅类型契约） */
export type KkmodHostApi = {
  event: { emit: (name: string, data?: unknown) => void; on: (name: string, fn: (data: unknown) => void) => () => void };
  settle: { apply: (patch: Record<string, unknown>) => void };
  ui: { panel: (id: string, props?: Record<string, unknown>) => void; toast: (msg: string) => void };
  notify: { push: (title: string, body?: string) => void };
  save: {
    /** 仅当前作品存档槽 */
    game: { read: <T = unknown>(key: string) => T | undefined; write: (key: string, value: unknown) => void };
  };
  phone?: { openApp: (appId: string) => void };
};

export function assertManifest(m: Partial<KkmodManifest>): string[] {
  const need = ["id", "slug", "name", "version", "kind", "dependencies", "permissions", "configSchema", "saveMigrate", "testCases"] as const;
  const errs: string[] = [];
  for (const k of need) if (m[k] === undefined || m[k] === null) errs.push(`缺少 manifest.${k}`);
  if (m.kind && m.kind !== "gameplay" && m.kind !== "phone_app") errs.push("kind 须为 gameplay | phone_app");
  for (const p of m.permissions || []) {
    if ((KKMOD_FORBIDDEN_PERMISSIONS as readonly string[]).includes(p)) errs.push(`禁止权限 ${p}`);
    else if (!(KKMOD_ALLOWED_PERMISSIONS as readonly string[]).includes(p)) errs.push(`未开放权限 ${p}`);
  }
  return errs;
}

export function packKkmod(pkg: KkmodPackage): string {
  const errs = assertManifest(pkg.manifest);
  if (errs.length) throw new Error(errs.join("；"));
  return JSON.stringify({ manifest: pkg.manifest, payload: pkg.payload ?? {} }, null, 2);
}

export function parseKkmodJson(raw: string): KkmodPackage {
  const o = JSON.parse(raw) as KkmodPackage | KkmodManifest;
  const manifest = "manifest" in o && o.manifest ? o.manifest : (o as KkmodManifest);
  const payload = "payload" in o && o.payload ? o.payload : {};
  const errs = assertManifest(manifest);
  if (errs.length) throw new Error(errs.join("；"));
  return { manifest, payload };
}

/* 属性 SDK：自定义属性定义 / 引用写法 / 校验 / AI 规范说明 */
export * from "./attrs";
/* 文件 SDK：材质包式虚拟目录（同路径覆盖原版） */
export * from "./files";
/* 手机应用 SDK：kkapp@1 配置式可交互应用 */
export * from "./phoneApp";
