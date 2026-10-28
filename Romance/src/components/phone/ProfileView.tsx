/* 个人主页（微信「个人相册」式）：确定性档案 + 首次进入时 AI 生成的近况签名（生成后缓存，不重复生成）。
 * 架构与版式为手写；「没进去过的人」的主页文案才交给 AI 生成一次，之后读缓存。 */
import { loadData, saveData, onClearPlayerMemory } from "../../lib/saveScope";
import { useMemo, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { resumeOf } from "../../worlds/star2005/content";
import { LIVE_PERSON_BY_ID as PERSON_BY_ID, worldPersonById as profileOf } from "../../mods/registry";
import { complete, isConfigured } from "../../lib/ai";
import { Lightbox } from "./shared";
import { getFeedMoments } from "./Moments";
import { liveTerm as T } from "../../mods/live";

/* 主页近况文案缓存：内存 + localStorage（key 内含存档 id，避免跨档串味） */
const memCache = new Map<string, string>();
onClearPlayerMemory(() => memCache.clear());
const cacheKey = (gid: string, pid: string) => `star2005.profile.${gid}.${pid}`;
function readCache(gid: string, pid: string): string | null {
  const k = cacheKey(gid, pid);
  if (memCache.has(k)) return memCache.get(k)!;
  try {
    const v = loadData<string>(k, "");
    if (v) { memCache.set(k, v); return v; }
  } catch { /* ignore */ }
  return null;
}
function writeCache(gid: string, pid: string, text: string) {
  const k = cacheKey(gid, pid);
  memCache.set(k, text);
  saveData(k, text);
}

export default function ProfileView({ pid, onBack }: { pid: string; onBack: () => void }) {
  const { game, cfg } = useGame();
  const g = game!;
  const npc = g.npcs.find((n) => n.id === pid);
  const p = profileOf(pid);
  const name = npc?.name ?? p?.name ?? "";
  const role = p?.role ?? npc?.relation ?? "";
  const known = !!npc; // 已进入通讯录/剧情登场者即「相识」；陌生人主页由 AI 生成
  const works = p?.works ?? [];
  const resume = useMemo(() => resumeOf(pid).filter((e) => !e.hidden), [pid]);

  // 相册只放 TA 在朋友圈真实发过的图片，没有就留空
  const album = useMemo(() => getFeedMoments().filter((m) => m.pid === pid).flatMap((m) => m.imgs ?? []).slice(0, 9), [pid]);

  const fallback = p?.bio ?? npc?.bio ?? "";
  const [intro, setIntro] = useState<string | null>(() => readCache(g.id, pid));
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const [genErr, setGenErr] = useState(false);
  // 只在玩家点「生成近况」时调用 AI；结果缓存，失败不替换为任何文案
  const genIntro = () => {
    if (loading || !isConfigured(cfg)) return;
    setLoading(true); setGenErr(false);
    const facts = [
      `姓名：${name}`,
      role && `身份：${role}`,
      works.length && `代表作：${works.join("、")}`,
      p?.tags?.length && `标签：${p.tags.join("、")}`,
      `背景：${fallback}`,
    ].filter(Boolean).join("\n");
    complete(cfg, [
      { role: "system", content: `你在为2005年中国${T("industry")}的一位人物撰写其社交主页上的『个性签名 + 近况』。要求：第一人称，60-110字，贴合其身份、性格与那个年代的语感（含蓄、书面、无现代网络热词与emoji滥用），可含一句签名与两三句近况。只输出正文，不要解释。` },
      { role: "user", content: facts },
    ])
      .then((text) => {
        const clean = (text || "").trim();
        if (!clean) { setGenErr(true); return; }
        writeCache(g.id, pid, clean);
        setIntro(clean);
      })
      .catch(() => setGenErr(true))
      .finally(() => setLoading(false));
  };

  return (
    <div className="relative flex h-full flex-col bg-[#ededed]">
      {/* 顶栏 */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center px-3 pb-2 pt-2 text-white">
        <button onClick={onBack} className="text-[14px] drop-shadow">‹ 返回</button>
        <span className="flex-1 text-center text-[15px] font-semibold drop-shadow">{name}</span>
        <span className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 封面 + 头像 + 名字 */}
        <div className="relative h-44 bg-[#2b2f36]">
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-black/10" />
          <div className="absolute -bottom-6 right-3 flex items-end gap-2.5">
            <span className="pb-8 text-right text-[16px] font-semibold text-white drop-shadow">{name}</span>
            <div className="overflow-hidden rounded-[8px] ring-2 ring-white"><Avatar src={npc?.avatar} name={name} size={62} editable={false} /></div>
          </div>
        </div>

        <div className="mt-8 space-y-2.5 px-4 pb-6">
          {/* 身份 / 与你的关系 */}
          <div className="rounded-xl bg-white px-4 py-3">
            {role && <p className="text-[13px] text-ink-soft">{role}</p>}
            <p className="mt-1 text-[12.5px] text-ink-soft">
              与你：<span className="text-ink">{known ? (npc?.relation ?? p?.relation ?? "已相识") : "尚未相识"}</span>
            </p>
          </div>

          {/* 近况 / 个性签名（AI 生成一次后缓存） */}
          <div className="rounded-xl bg-white px-4 py-3.5">
            <p className="mb-1.5 text-[11px] font-bold tracking-widest text-[#5b6b8c]">个性签名 · 近况</p>
            {loading ? (
              <p className="flex items-center gap-1.5 text-[13px] text-ink-soft">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#07c160]" /> 正在了解 TA…
              </p>
            ) : (
              <>
                {(intro ?? fallback) ? <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink/90">{intro ?? fallback}</p> : <p className="text-[13px] text-ink-soft">TA 还没有留下签名</p>}
                {genErr && <p className="mt-1 text-[12px] text-[#e5484d]">生成失败，请重试</p>}
                {isConfigured(cfg) ? (
                  <button onClick={genIntro} className="mt-2 rounded-full bg-[#07c160]/10 px-3 py-1 text-[12px] font-medium text-[#07c160]">{intro ? "重新生成近况" : "生成近况"}</button>
                ) : !intro && <p className="mt-1 text-[12px] text-ink-soft">接入 AI 后可生成 TA 的近况</p>}
              </>
            )}
          </div>

          {/* 个人相册 */}
          <div className="rounded-xl bg-white px-4 py-3.5">
            <p className="mb-2 text-[11px] font-bold tracking-widest text-[#5b6b8c]">相册</p>
            {!album.length && <p className="text-[12.5px] text-ink-soft">TA 还没有公开的照片</p>}
            <div className="grid grid-cols-3 gap-1.5">
              {album.map((src, k) => (
                <button key={k} onClick={() => setLightbox(src)} className="overflow-hidden rounded-md bg-black/5">
                  <img src={(src) || undefined} alt="" loading="lazy" className="aspect-square h-full w-full object-cover transition active:scale-95" />
                </button>
              ))}
            </div>
          </div>

          {/* 代表作 */}
          {works.length > 0 && (
            <div className="rounded-xl bg-white px-4 py-3.5">
              <p className="mb-2 text-[11px] font-bold tracking-widest text-[#5b6b8c]">代表作</p>
              <div className="flex flex-wrap gap-1.5">
                {works.map((w) => (
                  <span key={w} className="rounded-full bg-[#f2f4f7] px-2.5 py-1 text-[12.5px] text-ink/80">《{w}》</span>
                ))}
              </div>
            </div>
          )}

          {/* 履历（相识后可见） */}
          {known && resume.length > 0 && (
            <div className="rounded-xl bg-white px-4 py-3.5">
              <p className="mb-2 text-[11px] font-bold tracking-widest text-[#5b6b8c]">履历</p>
              <div className="space-y-2">
                {resume.map((e, i) => (
                  <div key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
                    <span className="w-16 shrink-0 tabular-nums text-[#b8862b]">{e.year}{e.month ? `.${e.month}` : ""}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-ink">{e.title}</span>
                      {e.detail && <span className="text-ink/70"> — {e.detail}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

export { PERSON_BY_ID };
