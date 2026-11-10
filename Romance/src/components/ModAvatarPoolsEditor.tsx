import { useEffect, useRef, useState } from "react";
import type { AvatarMatchPrefer, AvatarPoolToggle, AvatarSlot } from "../lib/types";
import { resolveAvatarMatchPrefs } from "../lib/types";
import { AVATAR_POOLS_EVENT, PUBLIC_AVATAR_CATS, PUBLIC_AVATAR_NAMES, readAvatarPools, writeAvatarPools, type AvatarPool } from "../game/avatarPools";
import { compressImage, loadHost, uploadToHost } from "../lib/freeStyle";

/* 头像只存进头像池：有图床走图床，否则本地压成 320px（不顺带收进素材库，免得本地存两份） */
const toAvatarUrl = (f: File) => { const h = loadHost(); return h.kind === "imgbb" && h.key ? uploadToHost(f, h) : compressImage(f, 320, 0.82); };

/* 模组编辑器 · 头像（单块）：私库 / 公库匹配、我的头像池、平台公共分类都在「头像」里配，不拆三个大标题。
 * 我的头像池：账号级（本机）跨剧本共享，本剧逐池勾「玩家可选」（→ 游玩端「创作者头像库」）/「随机池」（→ AI 新增人脉抽图）。
 * 平台公共分类：游玩端「系统头像库」始终实时可选，本剧只需勾「随机池」。
 * 后台仍用池名与人物 avatarVariant 精确匹配；创作者界面不展示该变量名。 */
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const chk = "flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 transition";
/** 功能注释：块内小标题，刻意低于 Section 级大标题，避免再拆成三块「大标题」 */
const sub = "text-[11.5px] font-semibold text-ink-soft";

/** 功能注释：开关用深色底+浅字，避免浅粉卡片上浅灰字看不清 */
function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <label className={`${chk} ${on ? "bg-ink text-paper ring-ink" : "bg-ink/75 text-paper/90 ring-ink/40 hover:bg-ink hover:text-paper"}`}>
      <input type="checkbox" className="accent-jade" checked={on} onChange={(e) => onChange(e.target.checked)} />{label}
    </label>
  );
}

export default function ModAvatarPoolsEditor({ value, onChange, confirm }: {
  value?: AvatarSlot; onChange: (v?: AvatarSlot) => void;
  confirm: (msg: string, o?: { ok?: string }) => Promise<boolean>;
}) {
  const v = value ?? {};
  const [open, setOpen] = useState(false);
  /** 功能注释：平台公共分类默认收起，点标题才展开青年/成熟/幼年，避免一进编辑器就整屏摊开 */
  const [publicOpen, setPublicOpen] = useState(false);
  const [lib, setLib] = useState<AvatarPool[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const files = useRef<Record<string, HTMLInputElement | null>>({});

  // 展开后同步跨剧本头像库（别的剧本 / 别的标签页改过也能跟上）
  useEffect(() => {
    if (!open) return;
    const sync = () => setLib(readAvatarPools());
    sync();
    window.addEventListener(AVATAR_POOLS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(AVATAR_POOLS_EVENT, sync); window.removeEventListener("storage", sync); };
  }, [open]);

  const emit = (n: AvatarSlot) => {
    const pools = Object.fromEntries(Object.entries(n.pools ?? {}).filter(([, t]) => t.pick || t.random));
    const out: AvatarSlot = {};
    if (Object.keys(pools).length) out.pools = pools;
    if (n.publicRandom?.length) out.publicRandom = n.publicRandom;
    // 功能注释：匹配优先级随剧本持久化；仅当与平台默认不同或曾显式配置时写入，导入导出一并带走
    if (n.match && (n.match.prefer === "public" || n.match.prefer === "private" || n.match.allowUniversalFallback === false || n.match.allowUniversalFallback === true)) {
      const match: NonNullable<AvatarSlot["match"]> = {};
      if (n.match.prefer === "public" || n.match.prefer === "private") match.prefer = n.match.prefer;
      if (typeof n.match.allowUniversalFallback === "boolean") match.allowUniversalFallback = n.match.allowUniversalFallback;
      if (Object.keys(match).length) out.match = match;
    }
    onChange(Object.keys(out).length ? out : undefined);
  };

  const resolved = resolveAvatarMatchPrefs(v);
  /** 功能注释：点「公共库优先」时一并展开平台公共分类，方便立刻勾随机池 */
  const setMatchPrefer = (prefer: AvatarMatchPrefer) => {
    if (prefer === "public") setPublicOpen(true);
    emit({ ...v, match: { ...v.match, prefer } });
  };
  const setAllowUniversal = (allowUniversalFallback: boolean) => emit({ ...v, match: { ...v.match, allowUniversalFallback } });
  const setToggle = (pool: string, p: Partial<AvatarPoolToggle>) => {
    const t = { ...v.pools?.[pool], ...p };
    for (const k of Object.keys(t) as (keyof AvatarPoolToggle)[]) if (!t[k]) delete t[k];
    emit({ ...v, pools: { ...v.pools, [pool]: t } });
  };
  const save = (next: AvatarPool[], ok?: string) => {
    if (writeAvatarPools(next)) { setLib(next); if (ok) setMsg(ok); return true; }
    setMsg("保存失败：本地存储已满。可删掉一些头像，或在「图床」设置里接入图床后再上传。");
    return false;
  };
  const nameErr = (n: string, self?: string) =>
    !n ? "池名不能为空" : PUBLIC_AVATAR_NAMES.has(n) ? "与平台公共分类重名" : lib.some((p) => p.name === n && p.id !== self) ? "已有同名头像池" : "";
  const create = () => {
    const n = name.trim();
    const e = nameErr(n);
    if (e) return setMsg(e);
    if (save([{ id: `av_${Date.now().toString(36)}`, name: n, images: [], at: Date.now() }, ...lib], `已创建「${n}」，上传几张头像吧`)) setName("");
  };
  /** 改名成功返回 true；失败时输入框复原 */
  const rename = (p: AvatarPool, raw: string): boolean => {
    const n = raw.trim();
    if (n === p.name) return true;
    const e = nameErr(n, p.id);
    if (e) { setMsg(`改名失败：${e}`); return false; }
    if (!save(lib.map((x) => (x.id === p.id ? { ...x, name: n } : x)), `已改名为「${n}」。其它剧本里按旧名勾的开关、人物填的同名头像池需同步改。`)) return false;
    // 本剧的开关跟着新名字走
    if (v.pools?.[p.name]) { const pools = { ...v.pools, [n]: v.pools[p.name] }; delete pools[p.name]; emit({ ...v, pools }); }
    return true;
  };
  const remove = async (p: AvatarPool) => {
    if (!(await confirm(`删除头像池「${p.name}」？所有剧本都会失去这个池（${p.images.length} 张头像）。`, { ok: "删除" }))) return;
    if (save(lib.filter((x) => x.id !== p.id), `已删除「${p.name}」`) && v.pools?.[p.name]) { const pools = { ...v.pools }; delete pools[p.name]; emit({ ...v, pools }); }
  };
  const upload = async (p: AvatarPool, list?: FileList | null) => {
    const fs = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (!fs.length) return;
    setBusy(p.id);
    const urls: string[] = [];
    try { for (const f of fs) urls.push(await toAvatarUrl(f)); }
    catch (e) { setMsg(`部分上传失败：${(e as Error).message}`); }
    setBusy(null);
    const fresh = readAvatarPools();
    if (urls.length) save(fresh.map((x) => (x.id === p.id ? { ...x, images: [...x.images, ...urls.filter((u) => !x.images.includes(u))] } : x)), `「${p.name}」新增 ${urls.length} 张`);
  };
  const dropImg = (p: AvatarPool, url: string) => save(lib.map((x) => (x.id === p.id ? { ...x, images: x.images.filter((u) => u !== url) } : x)));

  const enabled = Object.keys(v.pools ?? {});
  const missing = open ? enabled.filter((n) => !lib.some((p) => p.name === n)) : [];
  // 功能注释：publicRandom 可能是脏对象；非数组按空，禁止 new Set(非数组) → is not iterable
  const pubOn = new Set(Array.isArray(v.publicRandom) ? v.publicRandom : []);

  return (
    <div className="space-y-4 rounded-xl border border-line bg-paper-2 p-3">
      {/* 功能注释：私库/公库说明与 avatarVariant 变量名不对创作者展示；池名后台仍作 avatarVariant 匹配 */}
      {/* —— 匹配：本剧私库/公库先后 + 通用兜底（随模组保存，不写平台全局） —— */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className={sub}>匹配优先级</span>
          <span className="text-[11px] text-ink-soft">仅对本剧生效</span>
        </div>
        <div>
          <span className="mb-1 block text-[11px] text-ink-soft">库来源顺序</span>
          <div className="inline-flex rounded-lg border border-line bg-paper p-0.5 text-[12px] font-bold" role="radiogroup" aria-label="库来源顺序">
            {([
              { id: "private" as const, label: "私人库优先" },
              { id: "public" as const, label: "公共库优先" },
            ]).map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={resolved.prefer === o.id}
                onClick={() => setMatchPrefer(o.id)}
                className={`rounded-md px-3 py-1.5 transition ${resolved.prefer === o.id ? "bg-coral/15 text-coral ring-1 ring-coral/35" : "text-ink-soft hover:text-ink"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink">
          <input
            type="checkbox"
            className="accent-jade"
            checked={resolved.allowUniversalFallback}
            onChange={(e) => setAllowUniversal(e.target.checked)}
          />
          启用「通用」头像作为兜底
        </label>
      </div>

      {/* —— 私库：本机头像池 + 本剧开关 —— */}
      <div className="space-y-2 border-t border-line/70 pt-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="flex w-full items-center gap-2 text-left">
          <span className={sub}>我的头像池</span>
          {/* 功能注释：深色底状态徽标，替代浅底浅字「未配置」看不清 */}
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${enabled.length ? "bg-ink text-paper" : "bg-ink/80 text-paper/95"}`}>
            {enabled.length ? `本剧已开放 ${enabled.length} 个` : "未配置"}
          </span>
          <span className="min-w-0 flex-1 truncate text-right text-[11px] text-ink-soft">{open ? `本机共 ${lib.length} 个池` : "展开后同步跨剧本头像库"}</span>
          <span className={`text-[12px] text-ink-soft transition ${open ? "rotate-90" : ""}`} aria-hidden>›</span>
        </button>
        {open && (
          <div className="space-y-2.5">
            <div className="flex gap-1.5">
              <input className={inp} value={name} placeholder="新池名，如：古风男配 / 校园女生" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }} />
              <button type="button" className={`${btn} shrink-0`} onClick={create} disabled={!name.trim()}>＋ 新建头像池</button>
            </div>
            {msg && <p className="text-[11px] text-coral">{msg}</p>}
            {missing.map((n) => (
              <div key={n} className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/5 px-2.5 py-1.5 text-[11.5px] text-danger">
                <span className="min-w-0 flex-1">本剧勾了「{n}」，但本机头像库里没有这个池（可能已改名或删除）</span>
                <button type="button" className={btn} onClick={() => { const pools = { ...v.pools }; delete pools[n]; emit({ ...v, pools }); }}>移除开关</button>
              </div>
            ))}
            {!lib.length && <p className="rounded-lg border border-dashed border-line px-3 py-5 text-center text-[12px] text-ink-soft">还没有头像池。新建一个，上传同一类人物的头像（建议正方形、脸在上半部）。</p>}
            {lib.map((p) => {
              const t = v.pools?.[p.name] ?? {};
              return (
                <div key={p.id} className="space-y-2 rounded-xl border border-line bg-paper p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input className={`${inp} !w-44 font-semibold`} defaultValue={p.name} key={p.name} aria-label="池名"
                      onBlur={(e) => { if (!rename(p, e.target.value)) e.target.value = p.name; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                    <span className="text-[11px] text-ink-soft">{p.images.length} 张</span>
                    <span className="flex-1" />
                    <Toggle on={!!t.pick} label="玩家可选" onChange={(x) => setToggle(p.name, { pick: x })} />
                    <Toggle on={!!t.random} label="随机池" onChange={(x) => setToggle(p.name, { random: x })} />
                    <button type="button" className={btn} onClick={() => void remove(p)} aria-label={`删除头像池 ${p.name}`}>删除</button>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                    {p.images.map((url) => (
                      <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-paper-2">
                        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
                        <button type="button" onClick={() => dropImg(p, url)} aria-label="删除这张"
                          className="absolute right-0.5 top-0.5 hidden h-5 w-5 place-items-center rounded-full bg-black/55 text-[11px] text-white group-hover:grid"></button>
                      </div>
                    ))}
                    <button type="button" disabled={busy === p.id} onClick={() => files.current[p.id]?.click()}
                      className="grid aspect-square place-items-center rounded-lg border border-dashed border-line text-[11px] text-ink-soft transition hover:border-jade hover:text-jade disabled:opacity-50">
                      {busy === p.id ? "上传中…" : "＋ 上传"}
                    </button>
                    <input ref={(el) => { files.current[p.id] = el; }} type="file" accept="image/*" multiple hidden
                      onChange={(e) => { void upload(p, e.target.files); e.target.value = ""; }} />
                  </div>
                  {(t.pick || t.random) && !p.images.length && <p className="text-[10.5px] text-coral">这个池还是空的，开关暂不生效。</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* —— 公库分类：默认收起，点标题展开后再勾随机池 —— */}
      <div className="space-y-2 border-t border-line/70 pt-3">
        <button type="button" onClick={() => setPublicOpen((o) => !o)} aria-expanded={publicOpen}
          className="flex w-full items-center gap-2 text-left">
          <span className={sub}>平台公共分类</span>
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${pubOn.size ? "bg-ink text-paper" : "bg-ink/80 text-paper/95"}`}>
            {resolved.prefer === "public" ? "已自动启用" : pubOn.size ? `${pubOn.size} 个进随机池` : "未进随机池"}
          </span>
          <span className="min-w-0 flex-1 truncate text-right text-[11px] text-ink-soft">
            {resolved.prefer === "public" ? "公共库优先：按性别 / 年龄自动匹配对应分类" : publicOpen ? "私人库不够时，可勾选补充到随机池" : "点此展开青年 / 成熟 / 幼年"}
          </span>
          <span className={`text-[12px] text-ink-soft transition ${publicOpen ? "rotate-90" : ""}`} aria-hidden>›</span>
        </button>
        {publicOpen && (
          <div className="grid gap-2 sm:grid-cols-2">
            {PUBLIC_AVATAR_CATS.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-paper px-2.5 py-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-paper-2 text-[11px] font-bold text-ink-soft" aria-hidden>
                  {c.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-bold text-ink">{c.name}</div>
                  <div className="truncate text-[10.5px] text-ink-soft">{c.hint} · 图源平台入库</div>
                </div>
                {resolved.prefer !== "public" && <Toggle on={pubOn.has(c.name)} label="随机池" onChange={(x) => {
                  const s = new Set(pubOn); if (x) s.add(c.name); else s.delete(c.name);
                  emit({ ...v, publicRandom: PUBLIC_AVATAR_CATS.map((k) => k.name).filter((n) => s.has(n)) });
                }} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
