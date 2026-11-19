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

/** 功能注释：把平台草稿 id 写回地址栏（replaceState），续编 / 发布共用同一 fileId。 */
export function writeRomancePlatformDraftId(fileId: string): void {
  const id = String(fileId || "").trim();
  if (!id || typeof location === "undefined" || typeof history === "undefined") return;
  try {
    const url = new URL(location.href);
    url.searchParams.set("draftId", id);
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
}

/**
 * 功能注释：入口未带 draftId 时补建一条平台草稿（POST /drafts/romance），成功后写回 URL。
 * 正常路径仍应由创作者中心入口先 create；这里只兜底「本机进向导后仍要发布」的情况。
 */
export async function ensureRomancePlatformDraftId(
  apiBase = resolveFunloomApiBase(),
): Promise<string> {
  const existing = readRomancePlatformDraftId();
  if (existing) return existing;
  const token = readFunloomAuthToken();
  if (!token) return "";
  const base = String(apiBase || "").trim().replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/auth/games/drafts/romance`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: { fileId?: string } | null;
    } | null;
    const id = String(json?.data?.fileId || "").trim();
    if (!res.ok || !json?.success || !id) return "";
    writeRomancePlatformDraftId(id);
    return id;
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

/** 功能注释：从 mod 抽书架封面；优先 manifest.cover，否则 content.cover 首图。 */
export function resolveRomanceDraftCoverUrl(
  mod: Pick<Mod, "cover" | "content"> | null | undefined,
): string {
  // 功能注释：封面字段可能是字符串，也可能是 AI 生成的 { url / src / image } 对象（G-02：有封面仍报缺封面 / 把 [object Object] 当封面）
  const pick = (v: unknown): string => {
    if (typeof v === "string") return v.trim();
    if (v && typeof v === "object") {
      const o = v as { url?: unknown; src?: unknown; image?: unknown };
      for (const x of [o.url, o.src, o.image]) if (typeof x === "string" && x.trim()) return x.trim();
    }
    return "";
  };
  const direct = pick(mod?.cover);
  if (direct) return direct;
  const cover = mod?.content?.cover;
  if (!cover || typeof cover !== "object") return "";
  const image = pick((cover as { image?: unknown }).image);
  if (image) return image;
  const cgs = (cover as { cgs?: unknown }).cgs;
  if (Array.isArray(cgs)) {
    for (const item of cgs) {
      const url = pick(item);
      if (url) return url;
    }
  }
  return "";
}

/**
 * 功能注释：PATCH 更新已有草稿；失败返回 false，禁止回落到 create。
 * coverUrl 有值时写回 games.cover_url，并镜像 portrait_cover_url（Romance 单封面满足发布双封面校验）。
 */
export async function patchRomancePlatformDraft(
  fileId: string,
  title: string,
  coverUrl?: string | null,
): Promise<boolean> {
  const id = String(fileId || "").trim();
  if (!id) return false;
  const token = readFunloomAuthToken();
  if (!token) return false;
  try {
    const body: {
      title: string;
      cover_url?: string | null;
      portrait_cover_url?: string | null;
    } = {
      title: resolveRomanceDraftTitle(title),
    };
    if (coverUrl !== undefined) {
      body.cover_url = coverUrl || null;
      // 功能注释：单封面镜像竖版，避免发布接口因缺 portrait_cover_url 返回 400
      body.portrait_cover_url = coverUrl || null;
    }
    const res = await fetch(romanceDraftUpdateUrl(id), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    const json = await res.json().catch(() => null) as { success?: boolean } | null;
    return json?.success === true;
  } catch {
    return false;
  }
}

/**
 * 功能注释：发布前把 mod.themeTagId 全量写到平台 game_tag_map，并顺带写入面向人群。
 * 失败返回 false；调用方应阻止继续 publish，避免题材缺失 400。
 */
export async function syncRomancePlatformThemeTags(
  fileId: string,
  themeTagId: number,
  audienceType: "male" | "female" | "all",
  apiBase = resolveFunloomApiBase(),
): Promise<boolean> {
  const id = String(fileId || "").trim();
  const tagId = Number(themeTagId);
  if (!id || !Number.isFinite(tagId) || tagId <= 0) return false;
  const token = readFunloomAuthToken();
  if (!token) return false;
  const base = String(apiBase || "").trim().replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/auth/games/tags`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileId: id,
        tagIds: [tagId],
        audienceType,
      }),
    });
    const json = await res.json().catch(() => null) as { success?: boolean } | null;
    return res.ok && json?.success === true;
  } catch {
    return false;
  }
}

/**
 * 功能注释：是否该 GET 平台正文。
 * 新建入口只有 draftId、无 resume、无本机重载 → 禁止请求（无意义的空拉）。
 * 书架 resume=1，或 boot 仍在从 IDB 拉大体积稿时才拉；空壳现返回 200+empty。
 */
export function shouldFetchRomancePlatformDraftContent(input: {
  platformDraftId: string;
  wantResume: boolean;
  pendingHeavy?: boolean;
}): boolean {
  const id = String(input.platformDraftId || "").trim();
  if (!id) return false;
  return !!(input.wantResume || input.pendingHeavy);
}

/**
 * 功能注释：书架续编拉正文的结果。
 * ready=有 mod+draft；empty=账号下空壳可继续创作；gone=不存在/已删；error=鉴权或网络失败。
 */
export type RomanceDraftContentLoad =
  | { status: "ready"; content: RomancePlatformDraftContent }
  | { status: "empty" }
  | { status: "gone" }
  | { status: "error" };

/**
 * 功能注释：解析 GET content 响应；空壳走 200+empty，禁止再当 404 死胡同。
 * 兼容旧后端仍返回 404 + draft_content_missing 时也视为 empty。
 */
export function classifyRomanceDraftContentResponse(
  status: number,
  json: { success?: boolean; data?: unknown; empty?: boolean; code?: string } | null,
): RomanceDraftContentLoad {
  if (status === 401 || status === 403) return { status: "error" };
  if (status === 404 || status === 410) {
    const code = String(json?.code || "");
    if (code === "draft_content_missing" || code === "draft_content_empty") {
      return { status: "empty" };
    }
    return { status: "gone" };
  }
  if (status < 200 || status >= 300) return { status: "error" };
  if (json?.success === true && json.empty === true) return { status: "empty" };
  if (json?.success === true && isUsableRomancePlatformDraftContent(json.data)) {
    return { status: "ready", content: json.data };
  }
  if (json?.success === true && (json.data == null || json.data === undefined)) {
    return { status: "empty" };
  }
  return { status: "error" };
}

/**
 * 功能注释：按作品 ID 取回编辑器正文（含空壳/已删分类）；书架 resume 必须区分 empty 与 gone。
 */
export async function loadRomancePlatformDraftContent(
  fileId: string,
): Promise<RomanceDraftContentLoad> {
  const id = String(fileId || "").trim();
  if (!id) return { status: "gone" };
  const token = readFunloomAuthToken();
  if (!token) return { status: "error" };
  try {
    const res = await fetch(romanceDraftContentUrl(id), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    const json = await res.json().catch(() => null) as {
      success?: boolean;
      data?: unknown;
      empty?: boolean;
      code?: string;
    } | null;
    return classifyRomanceDraftContentResponse(res.status, json);
  } catch {
    return { status: "error" };
  }
}

/**
 * 功能注释：按作品 ID 取回编辑器正文；仅 ready 返回内容，其余 null（兼容旧调用方）。
 */
export async function fetchRomancePlatformDraftContent(
  fileId: string,
): Promise<RomancePlatformDraftContent | null> {
  const loaded = await loadRomancePlatformDraftContent(fileId);
  return loaded.status === "ready" ? loaded.content : null;
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
  update: (fileId: string, title: string, coverUrl?: string | null) => Promise<boolean>;
};

const defaultDeps: SyncDeps = { update: patchRomancePlatformDraft };

let inflight: Promise<boolean> | null = null;
let queued: { fileId: string; title: string; coverUrl?: string | null } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

type DraftSyncMeta = string | { title: string; coverUrl?: string | null };

function normalizeDraftSyncMeta(meta: DraftSyncMeta): { title: string; coverUrl?: string | null } {
  if (typeof meta === "string") return { title: resolveRomanceDraftTitle(meta) };
  return {
    title: resolveRomanceDraftTitle(meta.title),
    coverUrl: meta.coverUrl,
  };
}

/**
 * 功能注释：防抖合并多次自动保存；同 fileId 只保留最新标题/封面，禁止并发打出多条 create。
 * meta 可传标题字符串，或 `{ title, coverUrl }`（封面写入 games.cover_url）。
 */
export function scheduleRomancePlatformDraftSync(
  fileId: string,
  meta: DraftSyncMeta,
  deps: SyncDeps = defaultDeps,
  debounceMs = 1200,
): void {
  const id = String(fileId || "").trim();
  if (!id) return;
  const next = normalizeDraftSyncMeta(meta);
  queued = {
    fileId: id,
    title: next.title,
    coverUrl: next.coverUrl === undefined ? queued?.coverUrl : next.coverUrl,
  };
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
      return await deps.update(job.fileId, job.title, job.coverUrl);
    } catch {
      return false;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 功能注释：保存成功时立刻排队并 flush，保证书架 updated_at / 标题 / 封面同步。 */
export async function commitRomancePlatformDraft(
  fileId: string,
  meta: DraftSyncMeta,
  deps: SyncDeps = defaultDeps,
): Promise<boolean> {
  const id = String(fileId || "").trim();
  if (!id) return false;
  const next = normalizeDraftSyncMeta(meta);
  queued = {
    fileId: id,
    title: next.title,
    coverUrl: next.coverUrl,
  };
  return flushRomancePlatformDraftSync(deps);
}

/**
 * 功能注释：点保存 / 生成完成时同步标题 + 正文；正文失败仍尽量更新标题/封面。
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
  const coverUrl = resolveRomanceDraftCoverUrl(input.mod);
  const [titleOk, contentOk] = await Promise.all([
    commitRomancePlatformDraft(id, { title: input.title, coverUrl: coverUrl || null }, deps),
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

/** 功能注释：协议版本须与主站 CreatorPublishAgreementModal 对齐；换版后作者须重新勾选。 */
export const ROMANCE_CREATOR_AGREEMENT_VERSION = "1.0.0";
export const ROMANCE_REVIEW_STANDARDS_VERSION = "1.0.0";

export type RomancePublishInput = {
  /** 功能注释：沿用作品信息简介；弹窗不再二次填写 */
  description: string;
  /** 功能注释：首次正式上线不填；后续有改版入口再传 */
  versionNotes?: string;
  audienceType: "male" | "female" | "all";
  /** 功能注释：提交审核弹窗已去掉「通知收藏玩家」；默认不通知 */
  notifyFavoritedUsers?: boolean;
};

export type RomancePublishResult =
  | { ok: true; pendingReview: boolean }
  | { ok: false; message: string };

export type RomancePublishPrep = {
  /** 功能注释：用于同步封面与题材；缺封面/题材时提前失败，对齐后端 400 */
  mod: Mod;
  title?: string;
};

/**
 * 功能注释：提交发布审核；走主站同一 /api/auth/games/publish，先审作品返回 pending_review。
 * 真实场景：先镜像双封面 + 同步题材到平台，再 POST publish，避免「弹窗可提交但接口 400」。
 * 调用前须已把最新正文 PUT 到同一 fileId，否则审核看到的是旧版本。
 */
export async function publishRomancePlatformDraft(
  fileId: string,
  input: RomancePublishInput,
  prepOrApiBase?: RomancePublishPrep | string,
  apiBaseArg = resolveFunloomApiBase(),
): Promise<RomancePublishResult> {
  const prep = typeof prepOrApiBase === "object" && prepOrApiBase ? prepOrApiBase : null;
  const apiBase = typeof prepOrApiBase === "string" ? prepOrApiBase : apiBaseArg;
  const id = String(fileId || "").trim();
  if (!id) return { ok: false, message: "这个作品还没有关联平台草稿，无法发布" };
  const token = readFunloomAuthToken();
  if (!token) return { ok: false, message: "请先登录后再发布" };
  const base = String(apiBase || "").trim().replace(/\/$/, "");

  if (prep?.mod) {
    const coverUrl = resolveRomanceDraftCoverUrl(prep.mod);
    if (!coverUrl) {
      return { ok: false, message: "请先设置作品封面后再提交发布审核" };
    }
    const themeTagId = Number(prep.mod.themeTagId);
    if (!Number.isFinite(themeTagId) || themeTagId <= 0) {
      return { ok: false, message: "请先选择作品题材后再提交发布审核" };
    }
    const title = prep.title || prep.mod.name || "";
    const coverOk = await patchRomancePlatformDraft(id, title, coverUrl);
    if (!coverOk) {
      return { ok: false, message: "同步封面到平台失败，请检查网络后重试" };
    }
    const tagsOk = await syncRomancePlatformThemeTags(id, themeTagId, input.audienceType, base);
    if (!tagsOk) {
      return { ok: false, message: "同步作品题材失败，请检查网络后重试" };
    }
  }

  try {
    const res = await fetch(`${base}/api/auth/games/publish`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileId: id,
        priceAmount: 0,
        description: typeof input.description === "string" ? input.description : "",
        versionNotes: input.versionNotes || null,
        notifyFavoritedUsers: !!input.notifyFavoritedUsers,
        audienceType: input.audienceType,
        creatorAgreementVersion: ROMANCE_CREATOR_AGREEMENT_VERSION,
        workReviewStandardsVersion: ROMANCE_REVIEW_STANDARDS_VERSION,
        agreedAt: new Date().toISOString(),
      }),
    });
    const json = await res.json().catch(() => null) as {
      success?: boolean;
      message?: string;
      data?: { moderation_status?: string | null; moderationStatus?: string | null } | null;
    } | null;
    if (!res.ok || !json?.success) {
      return { ok: false, message: json?.message || "提交失败，请稍后再试" };
    }
    const status = json.data?.moderation_status ?? json.data?.moderationStatus ?? "";
    return {
      ok: true,
      pendingReview: status === "pending_review" || status === "update_pending_review",
    };
  } catch {
    return { ok: false, message: "网络异常，提交失败" };
  }
}
