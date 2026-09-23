/* 个人主页（微信「个人相册」式）：确定性档案 + 首次进入时 AI 生成的近况签名（生成后缓存，不重复生成）。
 * 架构与版式为手写；「没进去过的人」的主页文案才交给 AI 生成一次，之后读缓存。 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { PERSON_BY_ID, profileOf, resumeOf } from "../../worlds/star2005/content";
import { complete, isConfigured } from "../../lib/ai";
import { Lightbox } from "./shared";

const IMG = (id: string, w = 300, h = 300) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=75`;
const ALBUM_POOL = [
  "1612544409025-e1f6a56c1152", "1636936291087-2972edf08f14", "1532800783378-1bed60adaf58",
  "1527189919029-aeb3d997547d", "1484251065541-c9770829890f", "1547592180-85f173990554",
  "1748543668676-ea8241cb3886", "1522798514-97ceb8c4f1c8", "1517841905240-472988babdf9",
];
const COVERS = [
  "1470252649378-9c29740c9fa8", "1441974231531-c6227db76b6e", "1500534623283-312aade485b7",
  "1519681393784-d120267933ba", "1470071459604-3b5ec3a7fe05",
];

/* 主页近况文案缓存：内存 + localStorage（key 内含存档 id，避免跨档串味） */
const memCache = new Map<string, string>();
const cacheKey = (gid: string, pid: string) => `star2005.profile.${gid}.${pid}`;
function readCache(gid: string, pid: string): string | null {
  const k = cacheKey(gid, pid);
  if (memCache.has(k)) return memCache.get(k)!;
  try {
    const v = localStorage.getItem(k);
    if (v) { memCache.set(k, v); return v; }
  } catch { /* ignore */ }
  return null;
}
function writeCache(gid: string, pid: string, text: string) {
  const k = cacheKey(gid, pid);
  memCache.set(k, text);
  try { localStorage.setItem(k, text); } catch { /* ignore */ }
}

export default function ProfileView({ pid, onBack }: { pid: string; onBack: () => void }) {
  const { game, cfg } = useGame();
  const g = game!;
  const npc = g.npcs.find((n) => n.id === pid);
  const p = profileOf(pid);
  const name = npc?.name ?? p?.name ?? "神秘人";
  const role = p?.role ?? npc?.relation ?? "";
  const known = !!npc; // 已进入通讯录/剧情登场者即「相识」；陌生人主页由 AI 生成
  const works = p?.works ?? [];
  const resume = useMemo(() => resumeOf(pid).filter((e) => !e.hidden), [pid]);

  // 确定性配图（每人稳定）
  const seed = name.charCodeAt(0) + name.length * 7;
  const cover = IMG(COVERS[seed % COVERS.length], 560, 280);
  const album = useMemo(
    () => Array.from({ length: 6 }, (_, k) => IMG(ALBUM_POOL[(seed + k * 2) % ALBUM_POOL.length])),
    [seed],
  );

  const fallback = p?.bio ?? npc?.bio ?? "这个人还没有留下太多痕迹。";
  const [intro, setIntro] = useState<string | null>(() => readCache(g.id, pid));
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const askedRef = useRef(false);

  // 首次进入且未缓存：AI 生成一次近况签名并缓存；未配置 AI 则回退确定性简介。
  useEffect(() => {
    if (intro !== null || askedRef.current) return;
    askedRef.current = true;
    if (!isConfigured(cfg)) { setIntro(fallback); return; }
    setLoading(true);
    const facts = [
      `姓名：${name}`,
      role && `身份：${role}`,
      works.length && `代表作：${works.join("、")}`,
      p?.tags?.length && `标签：${p.tags.join("、")}`,
      `背景：${fallback}`,
    ].filter(Boolean).join("\n");
    complete(cfg, [
      { role: "system", content: "你在为2005年中国娱乐圈的一位人物撰写其社交主页上的『个性签名 + 近况』。要求：第一人称，60-110字，贴合其身份、性格与那个年代的语感（含蓄、书面、无现代网络热词与emoji滥用），可含一句签名与两三句近况。只输出正文，不要解释。" },
      { role: "user", content: facts },
    ])
      .then((text) => {
        const clean = (text || "").trim() || fallback;
        writeCache(g.id, pid, clean);
        setIntro(clean);
      })
      .catch(() => setIntro(fallback))
      .finally(() => setLoading(false));
  }, [intro, cfg, pid, name, role, works, p, fallback, g.id]);

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
          <img src={cover} alt="" className="h-full w-full object-cover" />
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
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink/90">{intro ?? fallback}</p>
            )}
          </div>

          {/* 个人相册 */}
          <div className="rounded-xl bg-white px-4 py-3.5">
            <p className="mb-2 text-[11px] font-bold tracking-widest text-[#5b6b8c]">相册</p>
            <div className="grid grid-cols-3 gap-1.5">
              {album.map((src, k) => (
                <button key={k} onClick={() => setLightbox(src)} className="overflow-hidden rounded-md bg-black/5">
                  <img src={src} alt="" loading="lazy" className="aspect-square h-full w-full object-cover transition active:scale-95" />
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
