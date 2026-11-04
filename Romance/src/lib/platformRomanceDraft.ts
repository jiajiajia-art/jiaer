/**
 * 功能注释：平台书架 Romance 草稿同步。
 * create 只在创作入口发生一次；编辑中保存/自动保存只 PATCH 同一 fileId。
 * 正文（mod+draft）另走 PUT/GET content，书架续编按作品 ID 打开，禁止落到空新建。
 */
import type { Mod } from "../mods/types.ts";
import type { WorldGenDraft, WorldGenStep1 } from "./worldGenWizard.ts";
import { readFunloomAuthToken, resolveFunloomApiBase } from "./platformAvatarLibrary.ts";

/** 功能注释：服务端存档正文；书架 resume 必须拿到 mod+draft。 */
export type RomancePlatformDraftContent = {
  version: 1;
  s1: WorldGenStep1 | WorldGenDraft;
  draft: WorldGenDraft;
  mod: Mod;
  updatedAt: number;
};

/** 功能注释：从 URL 读平台草稿 fileId；无则返回空（本机调试可不挂平台草稿）。 */
export function readRomancePlatformDraftId(
  search = typeof location !== "undefined" ? location.search : "",
): string {
  try {
    return new URLSearchParams(search).get("draftId")?.trim() || "";
  } catch {
    return "";
  }
}

/** 功能注释：书架展示标题；空名回落未命名，截断与后端一致。 */
export function resolveRomanceDraftTitle(name: string | null | undefined): string {
  const t = String(name ?? "").trim();
  return (t || "未命名 Romance 作品").slice(0, 80);
}

export function romanceDraftUpdateUrl(
  fileId: string,
  apiBase = resolveFunloomApiBase(),
): string {
  const base = String(apiBase || "").trim().replace(/\/$/, "");
  return `${base}/api/auth/games/drafts/romance/${encodeURIComponent(fileId)}`;
}

/** 功能注释：正文存档 URL；与标题 PATCH 同 fileId，路径加 /content。 */
export function romanceDraftContentUrl(
  fileId: string,
  apiBase = resolveFunloomApiBase(),
): string {
  return `${romanceDraftUpdateUrl(fileId, apiBase)}/content`;
}

/**
 * 功能注释：校验服务端/本地拼装的正文；缺 mod 或 draft 视为不可续编。
 */
export function isUsableRomancePlatformDraftContent(
  raw: unknown,
): raw is RomancePlatformDraftContent {
  if (!raw || typeof raw !== "object") return false;
  const row = raw as Partial<RomancePlatformDraftContent>;
  if (!row.mod || typeof row.mod !== "object") return false;
  if (!row.draft || typeof row.draft !== "object") return false;
  const mod = row.mod as Partial<Mod>;
  return !!(String(mod.id || "").trim() || String(mod.name || "").trim());
}

/**
 * 功能注释：组装 PUT 正文；保存与生成完成共用。
 */
export function buildRomancePlatformDraftContent(input: {
  mod: Mod;
  draft: WorldGenDraft;
  s1?: WorldGenStep1 | WorldGenDraft;
  updatedAt?: number;
}): RomancePlatformDraftContent {
  return {
    version: 1,
    s1: input.s1 ?? input.draft,
    draft: input.draft,
    mod: input.mod,
    updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : Date.now(),
  };
}

/**
 * 功能注释：PATCH 更新已有草稿；失败返回 false，禁止回落到 create。
 */
export async function patchRomancePlatformDraft(
  fileId: string,
  title: string,
): Promise<boolean> {
  const id = String(fileId || "").trim();
  if (!id) return false;
  const token = readFunloomAuthToken();
  if (!token) return false;
  try {
    const res = await fetch(romanceDraftUpdateUrl(id), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: resolveRomanceDraftTitle(title) }),
    });
    if (!res.ok) return false;
    const json = await res.json().catch(() => null) as { success?: boolean } | null;
    return json?.success === true;
  } catch {
    return false;
  }
}

/**
 * 功能注释：按作品 ID 取回编辑器正文；无存档返回 null（调用方提示打不开，禁止开空编辑器）。
 */
export async function fetchRomancePlatformDraftContent(
  fileId: string,
): Promise<RomancePlatformDraftContent | null> {
  const id = String(fileId || "").trim();
  if (!id) return null;
  const token = readFunloomAuthToken();
  if (!token) return null;
  try {
    const res = await fetch(romanceDraftContentUrl(id), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null) as {
      success?: boolean;
      data?: unknown;
    } | null;
    if (!json?.success || !isUsableRomancePlatformDraftContent(json.data)) return null;
    return json.data;
  } catch {
    return null;
  }
}

/**
 * 功能注释：把 mod+draft 写入平台存档；书架才能按同一 fileId 接着编辑。
 */
export async function putRomancePlatformDraftContent(
  fileId: string,
  content: RomancePlatformDraftContent,
): Promise<boolean> {
  const id = String(fileId || "").trim();
  if (!id || !isUsableRomancePlatformDraftContent(content)) return false;
  const token = readFunloomAuthToken();
  if (!token) return false;
  try {
    const res = await fetch(romanceDraftContentUrl(id), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(content),
    });
    if (!res.ok) return false;
    const json = await res.json().catch(() => null) as { success?: boolean } | null;
    return json?.success === true;
  } catch {
    return false;
  }
}

type SyncDeps = {
  /** 功能注释：实际发 PATCH；测试可注入。返回 false 表示失败（不抛）。 */
  update: (fileId: string, title: string) => Promise<boolean>;
};

const defaultDeps: SyncDeps = { update: patchRomancePlatformDraft };

let inflight: Promise<boolean> | null = null;
let queued: { fileId: string; title: string } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * 功能注释：防抖合并多次自动保存；同 fileId 只保留最新标题，禁止并发打出多条 create。
 */
export function scheduleRomancePlatformDraftSync(
  fileId: string,
  title: string,
  deps: SyncDeps = defaultDeps,
  debounceMs = 1200,
): void {
  const id = String(fileId || "").trim();
  if (!id) return;
  queued = { fileId: id, title: resolveRomanceDraftTitle(title) };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flushRomancePlatformDraftSync(deps);
  }, Math.max(0, debounceMs));
}

/** 功能注释：手动保存立刻落库；取消未触发的防抖。 */
export async function flushRomancePlatformDraftSync(
  deps: SyncDeps = defaultDeps,
): Promise<boolean> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queued) return true;
  if (inflight) {
    await inflight;
    if (!queued) return true;
  }
  const job = queued;
  queued = null;
  inflight = (async () => {
    try {
      return await deps.update(job.fileId, job.title);
    } catch {
      return false;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 功能注释：保存成功时立刻排队并 flush，保证书架 updated_at / 标题同步。 */
export async function commitRomancePlatformDraft(
  fileId: string,
  title: string,
  deps: SyncDeps = defaultDeps,
): Promise<boolean> {
  const id = String(fileId || "").trim();
  if (!id) return false;
  queued = { fileId: id, title: resolveRomanceDraftTitle(title) };
  return flushRomancePlatformDraftSync(deps);
}

/**
 * 功能注释：点保存 / 生成完成时同步标题 + 正文；正文失败仍尽量更新标题。
 */
export async function commitRomancePlatformDraftWithContent(
  fileId: string,
  input: {
    title: string;
    mod: Mod;
    draft: WorldGenDraft;
    s1?: WorldGenStep1 | WorldGenDraft;
  },
  deps: SyncDeps = defaultDeps,
): Promise<boolean> {
  const id = String(fileId || "").trim();
  if (!id) return false;
  const content = buildRomancePlatformDraftContent({
    mod: input.mod,
    draft: input.draft,
    s1: input.s1,
  });
  const [titleOk, contentOk] = await Promise.all([
    commitRomancePlatformDraft(id, input.title, deps),
    putRomancePlatformDraftContent(id, content),
  ]);
  return titleOk && contentOk;
}

/** 功能注释：单测 / 卸载时清掉定时器与队列，避免泄漏。 */
export function resetRomancePlatformDraftSyncForTests(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  queued = null;
  inflight = null;
}
