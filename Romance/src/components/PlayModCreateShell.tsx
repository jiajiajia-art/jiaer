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

const CREATOR_LOCKED_HINT =
  "需要过审作品解锁创作者身份即可使用。公开发布一部游戏世界并通过审核后解锁。";

async function uploadPlayKkmod(mod: Mod): Promise<{ ok: boolean; message: string }> {
  const token = readFunloomAuthToken();
  if (!token) return { ok: false, message: "请先登录后再上传玩法包" };
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
        engineVersion: "1.0.0",
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
): Promise<{ ok: true; mod: Mod } | { ok: false; message: string }> {
  const token = readFunloomAuthToken();
  if (!token) return { ok: false, message: "请先登录后再继续编辑" };
  try {
    const base = resolveFunloomApiBase().replace(/\/$/, "");
    const res = await fetch(`${base}/api/components/mine?kind=gameplay`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const json = await res.json().catch(() => null) as {
      success?: boolean;
      data?: { items?: Array<{ id?: string; slug?: string; payload?: unknown }> };
    } | null;
    const items = json?.success && Array.isArray(json.data?.items) ? json.data!.items! : [];
    const hit = items.find((x) => x.id === componentId || x.slug === componentId);
    if (!hit) return { ok: false, message: "没有找到这个玩法记录，或它不属于你" };
    const mod = modFromComponentPayload(hit.payload);
    if (!mod) return { ok: false, message: "该记录没有可编辑的玩法内容" };
    return { ok: true, mod: mod as unknown as Mod };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "加载失败" };
  }
}

export default function PlayModCreateShell({ onClose }: { onClose: () => void }) {
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");
  const [lastMod, setLastMod] = useState<Mod | null>(null);
  const [busy, setBusy] = useState(false);
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
        if (r.ok) setEditTarget({ mod: r.mod, isNew: false });
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
    const r = await uploadPlayKkmod(mod);
    setBusy(false);
    if (r.ok) setNotice(r.message);
    else setErr(r.message);
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
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-full bg-jade px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-40"
            onClick={() => void pushPlayModPackage(lastMod)}
          >
            {busy ? "上传中…" : "上传玩法包到组件商店"}
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
            setNotice(`已保存「${savedName}」。可继续上传玩法包到组件商店（私有测试 → 审核上架）。`);
            void pushPlayModPackage(savedMod);
            return;
          }
          leave();
        }}
      />
    </div>
  );
}
