/**
 * 功能注释：平台入口「创作游戏 → 玩法 Mod」。
 * 复用 AI 创意工坊的玩法对话界面，保存后可把玩法包上传组件商店（玩法运行在平台 SDK 上，创作者只交玩法包）。
 */
import { useCallback, useState } from "react";
import ModWorkshop from "./ModWorkshop";
import type { Mod } from "../mods/types";
import { clearPlayModCreateQuery } from "../lib/playModCreate";
import { kkmodPackageFromPlayMod, stringifyCreatorKkmod } from "../lib/kkmodFromCreators";
import { readFunloomAuthToken, resolveFunloomApiBase } from "../lib/platformAvatarLibrary";

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

export default function PlayModCreateShell({ onClose }: { onClose: () => void }) {
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");
  const [lastMod, setLastMod] = useState<Mod | null>(null);
  const [busy, setBusy] = useState(false);

  const leave = useCallback(() => {
    clearPlayModCreateQuery();
    onClose();
  }, [onClose]);

  const pushPlayModPackage = async (mod: Mod) => {
    setBusy(true);
    setErr("");
    setNotice("");
    const r = await uploadPlayKkmod(mod);
    setBusy(false);
    if (r.ok) setNotice(r.message);
    else setErr(r.message);
  };

  return (
    <div className="world-gen-shell world-gen-editor mx-auto min-h-screen max-w-3xl overflow-x-hidden px-3 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-5">
      <header className="mb-3">
        <p className="world-gen-kicker">创作游戏 · 玩法 Mod</p>
        <h1 className="world-gen-title">对话生成玩法</h1>
        <p className="world-gen-lead">
          用 AI 对话生成玩法叠加包（与编辑器「玩法创作 / AI 创意工坊」同一套）。包只扩展玩法，不替换原有人物、地点和时代；可绑多个游戏世界，也可分多次安装。能力都来自平台 SDK。保存后可上传组件商店，经审核上架后供各世界用「添加玩法」安装。
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
        forceMode="play"
        hideModeSwitch
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
