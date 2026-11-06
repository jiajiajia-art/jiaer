/**
 * 功能注释：创作者侧把「玩法 Mod / 手机应用」草稿打成专属 .kkmod，供 Mod 商店安装引用。
 */
import type { Mod } from "../mods/types.ts";
import {
  packKkmod,
  type ComponentKind,
  type KkmodManifest,
  type KkmodPackage,
} from "../mods/kkmod/sdk.ts";

const SAFE_SLUG = /^[a-z0-9][a-z0-9_-]{1,48}$/;

/** 功能注释：把任意标题收成 slug；空则用前缀+时间戳，保证 manifest.slug 合法。 */
export function slugifyCreatorId(raw: string, fallbackPrefix: string): string {
  const base = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (SAFE_SLUG.test(base)) return base;
  return `${fallbackPrefix}-${Date.now().toString(36)}`.slice(0, 48);
}

function baseManifest(
  kind: ComponentKind,
  input: {
    id: string;
    slug?: string;
    name: string;
    version?: string;
    description?: string;
    permissions?: string[];
    phoneAppId?: string;
    editorPanels?: string[];
    navLabel?: string;
    needsNav?: boolean;
  },
): KkmodManifest {
  const slug = slugifyCreatorId(input.slug || input.id, kind === "phone_app" ? "app" : "play");
  return {
    id: slugifyCreatorId(input.id || slug, kind === "phone_app" ? "app" : "play"),
    slug,
    name: String(input.name || "未命名").trim().slice(0, 80) || "未命名",
    version: String(input.version || "0.1.0").trim() || "0.1.0",
    kind,
    description: String(input.description || "").trim().slice(0, 500),
    dependencies: [],
    permissions: input.permissions?.length
      ? input.permissions
      : kind === "phone_app"
        ? ["ui.toast", "phone.openApp", "save.game.read", "save.game.write"]
        : ["event.emit", "settle.apply", "ui.toast", "save.game.read", "save.game.write"],
    configSchema: [],
    saveMigrate: [],
    testCases: [{ id: "smoke", name: "冒烟：启用后不崩溃", expect: "pass" }],
    editorPanels: input.editorPanels || [],
    phoneAppId: input.phoneAppId,
    priceKk: 0,
    navEntry: input.needsNav
      ? { needed: true, defaultLabel: input.navLabel || input.name }
      : { needed: false, defaultLabel: "" },
  };
}

/** 功能注释：玩法叠加包 Mod → gameplay .kkmod；payload 带完整 mod，游戏世界可安装引用。 */
export function kkmodPackageFromPlayMod(mod: Mod): KkmodPackage {
  const manifest = baseManifest("gameplay", {
    id: mod.id,
    slug: mod.id,
    name: mod.name,
    version: mod.version,
    description: mod.description,
    editorPanels: [],
  });
  return {
    manifest,
    payload: {
      mod: {
        id: mod.id,
        name: mod.name,
        version: mod.version,
        author: mod.author,
        description: mod.description,
        kind: "addon",
        slotMerge: mod.slotMerge || "merge",
        dependencies: mod.dependencies || [],
        content: mod.content || {},
      },
    },
  };
}

/** 功能注释：平台手机应用草稿 → phone_app .kkmod，供移动端安装。 */
export function kkmodPackageFromPhoneApp(app: {
  appId: string;
  name: string;
  summary?: string;
  icon?: string;
  type?: string;
  category?: string;
  content?: unknown;
  version?: string;
}): KkmodPackage {
  const manifest = baseManifest("phone_app", {
    id: app.appId,
    slug: app.appId,
    name: app.name,
    version: app.version || "0.1.0",
    description: app.summary || "",
    phoneAppId: app.appId,
    needsNav: true,
    navLabel: app.name,
  });
  return {
    manifest,
    payload: {
      platformApp: {
        appId: app.appId,
        name: app.name,
        summary: app.summary || "",
        icon: app.icon || "",
        type: app.type || "browse",
        category: app.category || "",
        content: app.content ?? {},
      },
    },
  };
}

export function stringifyCreatorKkmod(pkg: KkmodPackage): string {
  return packKkmod(pkg);
}
