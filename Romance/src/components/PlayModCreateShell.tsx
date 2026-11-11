/**
 * 功能注释：平台入口「创作游戏 → 玩法 Mod」。
 * 一层工作台：顶栏返回 + 对话区；复用工坊玩法模式；保存后可上传玩法包（运行在平台 SDK 上）。
 * C0.1：未激活创作者身份时拦截直链，不进半残表单。
 */
import { useCallback, useEffect, useState } from "react";
import ModWorkshop from "./ModWorkshop";
import type { Mod } from "../mods/types";
import {
  clearPlayModCreateQuery,
  modFromComponentPayload,
  readPlayModEditComponentId,
} from "../lib/playModCreate";
import { kkmodPackageFromPlayMod, stringifyCreatorKkmod } from "../lib/kkmodFromCreators";
import { readFunloomAuthToken, resolveFunloomApiBase } from "../lib/platformAvatarLibrary";
import { PLAY_MOD_PANEL_LABEL, PLAY_MOD_SDK_VERSION, derivePlayModEditorPanels, forbiddenFieldLabels, forbiddenPlayFields, sanitizeConflictIds } from "../mods/playModGuard";

const CREATOR_LOCKED_HINT =
  "需要过审作品解锁创作者身份即可使用。公开发布一部游戏世界并通过审核后解锁。";

/** 功能注释：商店预览图张数限制；上架至少 1 张，必须作者上传 */
const PREVIEW_MIN = 1;
const PREVIEW_MAX = 6;

/** 功能注释：上传前体检——阻断项 + 作者需要知道的装机效果 */
function playModPrecheck(mod: Mod): { errors: string[]; facts: string[] } {
  const errors: string[] = [];
  const facts: string[] = [];
  const bad = forbiddenPlayFields(mod.content);
  if (bad.length) errors.push(`含世界本体字段：${forbiddenFieldLabels(bad).join("、")}。请在对话里重新保存一次（会自动剥掉）`);
  const panels = derivePlayModEditorPanels(mod.content);
  facts.push(panels.length ? `装进世界后打开配置区：${panels.map((p) => PLAY_MOD_PANEL_LABEL[p] ?? p).join("、")}` : "不占用世界编辑器的扩展配置区");
  const nPanels = mod.ext?.panels?.length ?? 0;
  if (nPanels) facts.push(`游戏内页面 ${nPanels} 个（大界面显示，不进小手机）`);
  const rooms = Object.keys(mod.content?.rooms ?? {}).length;
  if (rooms) facts.push(`地点 ${rooms} 处`);
  const deps = [...(mod.deps ?? []).map((d) => (d.min ? `${d.id} ≥ ${d.min}` : d.id)), ...(mod.dependencies ?? []).filter((id) => !(mod.deps ?? []).some((d) => d.id === id))];
  if (deps.length) facts.push(`依赖：${deps.join("、")}（安装时会提示一并添加）`);
  const conflicts = sanitizeConflictIds(mod.conflictsWith, mod.id);
  if (conflicts.length) facts.push(`互斥：${conflicts.join("、")}（同一世界里不能同时添加）`);
  facts.push(`适配平台 SDK ≥ ${PLAY_MOD_SDK_VERSION}`);
  return { errors, facts };
}

/** 功能注释：上传一张预览图到平台图床（与手机应用预览图同一上传接口），返回图片 URL */
async function uploadPreviewImage(file: File): Promise<string> {
  const token = readFunloomAuthToken();
  if (!token) throw new Error("请先登录后再上传预览图");
  if (!file.type.startsWith("image/")) throw new Error("只能上传图片");
  const form = new FormData();
  form.append("file", file);
  const base = resolveFunloomApiBase().replace(/\/$/, "");
  const res = await fetch(`${base}/api/auth/platform-apps/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => null) as { success?: boolean; message?: string; data?: { imageUrl?: string } } | null;
  const url = json?.data?.imageUrl;
  if (!res.ok || !json?.success || !url) throw new Error(json?.message || "预览图上传失败");
  return String(url);
}

async function uploadPlayKkmod(mod: Mod, previewImages: string[]): Promise<{ ok: boolean; message: string }> {
  const token = readFunloomAuthToken();
  if (!token) return { ok: false, message: "请先登录后再上传玩法包" };
  if (previewImages.length < PREVIEW_MIN) return { ok: false, message: `请先上传至少 ${PREVIEW_MIN} 张预览图` };
  const pre = playModPrecheck(mod);
  if (pre.errors.length) return { ok: false, message: pre.errors.join("；") };
  const pkg = kkmodPackageFromPlayMod(mod);
  let raw: string;
  try {
    raw = stringifyCreatorKkmod(pkg);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "打包失败" };
  }
  try {
    const base = resolveFunloomApiBase().replace(/\/$/, "");
    const res = await fetch(`${base}/api/components/kkmod/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: `${pkg.manifest.slug}.kkmod`,
        package: JSON.parse(raw),
        engineVersion: PLAY_MOD_SDK_VERSION,
        // 功能注释：作者上传的商店预览图，后端写入组件 previewImages
        previewImages,
      }),
    });
    const json = await res.json().catch(() => null) as {
      success?: boolean;
      ok?: boolean;
      message?: string;
      data?: { message?: string };
    } | null;
    const ok = res.ok && (json?.success === true || json?.ok === true || !!json?.data);
    return {
      ok,
      message: json?.data?.message || json?.message || (ok ? "已上传玩法包并进入私有测试草稿" : "上传失败"),
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "网络错误" };
  }
}

/** 功能注释：直链门禁——查用户是否已有公开发布作品 */
async function fetchCreatorActivated(): Promise<boolean> {
  const token = readFunloomAuthToken();
  if (!token) return false;
  try {
    const base = resolveFunloomApiBase().replace(/\/$/, "");
    const res = await fetch(`${base}/api/auth/games/user?limit=200`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const json = await res.json().catch(() => null) as {
      success?: boolean;
      data?: Array<{ is_public?: number; moderation_status?: string; moderationStatus?: string }>;
    } | null;
    const list = json?.success && Array.isArray(json.data) ? json.data : [];
    return list.some((g) => {
      const moderation = String(g.moderationStatus || g.moderation_status || "none").toLowerCase();
      if (moderation === "pending_review" || moderation === "update_pending_review") return false;
      if (moderation === "rejected" || moderation === "update_rejected") return false;
      if (moderation === "delisted" || moderation === "taken_down") return false;
      return Number(g.is_public) === 1;
    });
  } catch {
    return false;
  }
}

/** 功能注释：C2.3 继续编辑——只在「我的组件」(本人) 里按 id 找记录，取不到就不载入，避免读到他人草稿 */
async function fetchMyPlayModForEdit(
  componentId: string,
): Promise<{ ok: true; mod: Mod; previewImages: string[] } | { ok: false; message: string }> {
  const token = readFunloomAuthToken();
  if (!token) return { ok: false, message: "请先登录后再继续编辑" };
  try {
    const base = resolveFunloomApiBase().replace(/\/$/, "");
    const res = await fetch(`${base}/api/components/mine?kind=gameplay`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const json = await res.json().catch(() => null) as {
      success?: boolean;
      data?: { items?: Array<{ id?: string; slug?: string; payload?: unknown; previewImages?: string[] }> };
    } | null;
    const items = json?.success && Array.isArray(json.data?.items) ? json.data!.items! : [];
    const hit = items.find((x) => x.id === componentId || x.slug === componentId);
    if (!hit) return { ok: false, message: "没有找到这个玩法记录，或它不属于你" };
    const mod = modFromComponentPayload(hit.payload);
    if (!mod) return { ok: false, message: "该记录没有可编辑的玩法内容" };
    return { ok: true, mod: mod as unknown as Mod, previewImages: Array.isArray(hit.previewImages) ? hit.previewImages : [] };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "加载失败" };
  }
}

export default function PlayModCreateShell({ onClose }: { onClose: () => void }) {
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");
  const [lastMod, setLastMod] = useState<Mod | null>(null);
  const [busy, setBusy] = useState(false);
  /** 功能注释：作者上传的商店预览图 URL；继续编辑时带出已有图 */
  const [previews, setPreviews] = useState<string[]>([]);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [gate, setGate] = useState<"checking" | "allowed" | "blocked">("checking");
  /** 功能注释：继续编辑的目标；editId 有值但 editTarget 为空时仍在加载 */
  const [editId] = useState(() => readPlayModEditComponentId());
  const [editTarget, setEditTarget] = useState<{ mod: Mod; isNew: boolean } | null>(null);
  const [editLoading, setEditLoading] = useState(() => !!readPlayModEditComponentId());

  const leave = useCallback(() => {
    clearPlayModCreateQuery();
    onClose();
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void fetchCreatorActivated().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        setGate("blocked");
        setErr(CREATOR_LOCKED_HINT);
        return;
      }
      setGate("allowed");
      if (!editId) return;
      void fetchMyPlayModForEdit(editId).then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setEditTarget({ mod: r.mod, isNew: false });
          setPreviews(r.previewImages);
        }
        else setErr(r.message);
        setEditLoading(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const pushPlayModPackage = async (mod: Mod) => {
    setBusy(true);
    setErr("");
    setNotice("");
    const r = await uploadPlayKkmod(mod, previews);
    setBusy(false);
    if (r.ok) setNotice(r.message);
    else setErr(r.message);
  };

  const addPreviews = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = PREVIEW_MAX - previews.length;
    if (room <= 0) {
      setErr(`预览图最多 ${PREVIEW_MAX} 张`);
      return;
    }
    setPreviewBusy(true);
    setErr("");
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, room)) urls.push(await uploadPreviewImage(f));
      setPreviews((p) => [...p, ...urls].slice(0, PREVIEW_MAX));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "预览图上传失败");
    } finally {
      setPreviewBusy(false);
    }
  };

  if (gate === "checking" || (gate === "allowed" && editLoading)) {
    return (
      <div className="world-gen-shell mx-auto min-h-screen max-w-3xl px-3 py-4 sm:px-5">
        <button type="button" className="mb-3 text-[13px] font-semibold text-ink-soft" onClick={leave}>
          ← 返回
        </button>
        <p className="text-[13px] text-ink-soft">校验创作者身份…</p>
      </div>
    );
  }

  if (gate === "blocked") {
    return (
      <div className="world-gen-shell mx-auto min-h-screen max-w-3xl px-3 py-4 sm:px-5">
        <button type="button" className="mb-3 text-[13px] font-semibold text-ink-soft" onClick={leave}>
          ← 返回
        </button>
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
          {CREATOR_LOCKED_HINT}
        </p>
        <button
          type="button"
          className="mt-3 rounded-full bg-jade px-3 py-1.5 text-[12px] font-bold text-white"
          onClick={leave}
        >
          返回创作类型选择
        </button>
      </div>
    );
  }

  return (
    <div className="world-gen-shell world-gen-editor mx-auto min-h-screen max-w-6xl overflow-x-hidden px-3 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-5">
      <header className="mb-3">
        <button type="button" className="mb-2 text-[13px] font-semibold text-ink-soft" onClick={leave}>
          ← 返回
        </button>
        <p className="world-gen-kicker">创作游戏 · 玩法 Mod</p>
        <h1 className="world-gen-title">对话生成玩法</h1>
        <p className="world-gen-lead">
          用自然语言生成玩法叠加包。包只扩展玩法，不替换原有人物、地点和时代；可绑多个游戏世界，也可分多次安装。能力都来自平台 SDK。默认从空白底叠加；也可选自己的世界草稿。
        </p>
      </header>
      {notice ? (
        <p className="mb-2 rounded-xl border border-jade/40 bg-jade/10 px-3 py-2 text-[12px] text-jade" role="status">
          {notice}
        </p>
      ) : null}
      {err ? (
        <p className="mb-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger" role="alert">
          {err}
        </p>
      ) : null}
      {lastMod ? (
        <section className="mb-3 rounded-xl border border-line bg-paper-2 p-3" aria-label="商店预览图">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-[13px] font-bold text-ink">商店预览图</h2>
            <span className="text-[11px] text-ink-soft">
              {previews.length}/{PREVIEW_MAX} · 至少 {PREVIEW_MIN} 张，玩家在「添加玩法」详情里看到
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {previews.map((url, i) => (
              <div key={url} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-line">
                <img src={url} alt={`预览图 ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-[11px] text-white"
                  aria-label={`删除预览图 ${i + 1}`}
                  onClick={() => setPreviews((p) => p.filter((x) => x !== url))}
                >
                  ×
                </button>
              </div>
            ))}
            {previews.length < PREVIEW_MAX && (
              <label className="grid aspect-[4/3] cursor-pointer place-items-center rounded-lg border border-dashed border-line text-[11px] text-ink-soft hover:border-jade/50">
                {previewBusy ? "上传中…" : "+ 添加图片"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  disabled={previewBusy}
                  onChange={(e) => {
                    void addPreviews(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </section>
      ) : null}
      {lastMod ? (
        (() => {
          const pre = playModPrecheck(lastMod);
          return (
            <section className="mb-3 rounded-xl border border-line bg-paper-2 p-3" aria-label="上传前体检">
              <h2 className="mb-1 text-[13px] font-bold text-ink">上传前体检</h2>
              <ul className="space-y-0.5 text-[12px] leading-relaxed">
                {pre.errors.map((e) => <li key={e} className="text-danger">{e}</li>)}
                {pre.facts.map((f) => <li key={f} className="text-ink-soft">{f}</li>)}
              </ul>
            </section>
          );
        })()
      ) : null}
      {lastMod ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || previewBusy || previews.length < PREVIEW_MIN || forbiddenPlayFields(lastMod.content).length > 0}
            className="rounded-full bg-jade px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-40"
            onClick={() => void pushPlayModPackage(lastMod)}
          >
            {busy ? "上传中…" : previews.length < PREVIEW_MIN ? "先添加预览图再上传" : "上传玩法包到组件商店"}
          </button>
          <button
            type="button"
            className="rounded-full border border-line bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink"
            onClick={leave}
          >
            完成并返回
          </button>
        </div>
      ) : null}
      <ModWorkshop
        key={editTarget?.mod.id || "new"}
        target={editTarget ?? undefined}
        forceMode="play"
        hideModeSwitch
        embedInShell
        livePreview
        onEdit={() => {
          /* 平台入口以对话为主；手改仍可在保存后进模组库 */
        }}
        onClose={(savedName, savedMod) => {
          if (savedName && savedMod) {
            setLastMod(savedMod);
            // 功能注释：不再保存即自动上传——必须先由作者添加预览图
            setNotice(`已保存「${savedName}」。添加至少 ${PREVIEW_MIN} 张预览图后，即可上传到组件商店（私有测试 → 审核上架）。`);
            return;
          }
          leave();
        }}
      />
    </div>
  );
}
