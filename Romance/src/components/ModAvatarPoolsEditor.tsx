import { useEffect, useRef, useState } from "react";
import type { AvatarMatchPrefer, AvatarPoolToggle, AvatarSlot } from "../lib/types";
import { resolveAvatarMatchPrefs } from "../lib/types";
import { AVATAR_POOLS_EVENT, enabledStylePackIds, PUBLIC_AVATAR_NAMES, readAvatarPools, writeAvatarPools, type AvatarPool } from "../game/avatarPools";
import { AVATAR_BACKGROUND_OPTIONS, DEFAULT_STYLE_PACKS, fetchPlatformStylePackOptions, fetchPlatformSystemAvatarPools, getCachedPlatformAvatarItems, listCachedStylePackIds, PLATFORM_AVATAR_GROUPS, platformAvatarDisplayUrl, type PlatformAvatarItem, type PlatformStylePackOption } from "../lib/platformAvatarLibrary";
import { Modal } from "./ui";
import { compressImage, loadHost, uploadToHost } from "../lib/freeStyle";

/* 头像只存进头像池：有图床走图床，否则本地压成 320px（不顺带收进素材库，免得本地存两份） */
const toAvatarUrl = (f: File) => { const h = loadHost(); return h.kind === "imgbb" && h.key ? uploadToHost(f, h) : compressImage(f, 320, 0.82); };

/* 模组编辑器 · 头像（单块）：私库 / 公库匹配、我的头像池、官方风格库都在「头像」里配，不拆三个大标题。
 * 我的头像池：账号级（本机）跨剧本共享。本剧用芯片勾选「玩家选用」哪些池；卡片上还能单独开「随机池」。
 * 官方风格库：勾选本剧用哪些平台风格包（二次元 / 写实 / 水墨，以及运营后加的）。性别和年龄按人物自动匹配，不在这里选。
 * 每个风格可以展开预览里面的头像，按性别和年龄分桶，点单张可以看大图。
 * 后台仍用池名与人物 avatarVariant 精确匹配；创作者界面不展示该变量名。 */
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const chk = "flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 transition";
/** 功能注释：块内小标题，刻意低于 Section 级大标题，避免再拆成三块「大标题」 */
const sub = "text-[11.5px] font-semibold text-ink-soft";

type StylePreviewShot = { id: string; url: string; title: string };

/** 功能注释：把一个风格库里的平台头像按性别×年龄摊开，方便创作者先看图再决定要不要用 */
function stylePackPreview(packId: string): { ready: boolean; groups: { id: string; name: string; images: StylePreviewShot[] }[] } {
  const items = getCachedPlatformAvatarItems();
  const mine = items.filter((it) => String(it.stylePack || "").trim() === packId);
  const used = new Set<string>();
  const shot = (it: PlatformAvatarItem, fallback: string): StylePreviewShot | null => {
    const url = platformAvatarDisplayUrl(it);
    if (!url) return null;
    const bg = AVATAR_BACKGROUND_OPTIONS.find((o) => o.id === String(it.backgroundType || "").trim())?.label;
    const title = [it.title, fallback, bg].filter(Boolean).join(" · ");
    return { id: it.id || url, url, title };
  };
  const groups = PLATFORM_AVATAR_GROUPS.map((g) => {
    const images = mine.flatMap((it) => {
      if (it.gender !== g.gender || it.ageGroup !== g.ageGroup) return [];
      used.add(it.id);
      const one = shot(it, g.name);
      return one ? [one] : [];
    });
    return { id: g.id, name: g.name, images };
  }).filter((g) => g.images.length);
  const universal = mine.flatMap((it) => {
    if (used.has(it.id) || it.gender !== "universal") return [];
    used.add(it.id);
    const one = shot(it, "通用");
    return one ? [one] : [];
  });
  if (universal.length) groups.push({ id: "universal", name: "通用", images: universal });
  const rest = mine.flatMap((it) => {
    if (used.has(it.id)) return [];
    const one = shot(it, "未分类");
    return one ? [one] : [];
  });
  if (rest.length) groups.push({ id: "orphan", name: "未分类", images: rest });
  return { ready: items.length > 0, groups };
}

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
  /** 功能注释：官方风格库默认收起，点标题才展开，避免一进编辑器就整屏摊开 */
  const [publicOpen, setPublicOpen] = useState(false);
  const [styles, setStyles] = useState<PlatformStylePackOption[]>(() => [...DEFAULT_STYLE_PACKS]);
  /** 功能注释：展开后若已拉到平台图，记下每个风格库有多少张；没拉到就不显示 0 */
  const [packCounts, setPackCounts] = useState<Record<string, number> | null>(null);
  /** 功能注释：展开哪一个官方风格库的头像预览；收起风格列表时一并关掉 */
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<StylePreviewShot | null>(null);
  const [lib, setLib] = useState<AvatarPool[]>(() => readAvatarPools());
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

  // 功能注释：风格库名单走平台 tag-options；同时拉一次头像，把库里多出来的风格 id 和张数补上
  useEffect(() => {
    if (!publicOpen) return;
    let cancel = false;
    void (async () => {
      const list = await fetchPlatformStylePackOptions();
      if (cancel) return;
      try { await fetchPlatformSystemAvatarPools(); } catch { /* 未登录或库空时仍用风格名单 */ }
      if (cancel) return;
      const next = list.length ? [...list] : [...DEFAULT_STYLE_PACKS];
      for (const id of listCachedStylePackIds()) {
        if (!next.some((o) => o.id === id)) next.push({ id, label: id });
      }
      const items = getCachedPlatformAvatarItems();
      const tally: Record<string, number> = {};
      for (const it of items) {
        const id = String(it.stylePack || "").trim();
        if (id) tally[id] = (tally[id] ?? 0) + 1;
      }
      setStyles(next);
      setPackCounts(items.length ? tally : null);
    })();
    return () => { cancel = true; };
  }, [publicOpen]);

  const emit = (n: AvatarSlot) => {
    const pools = Object.fromEntries(Object.entries(n.pools ?? {}).filter(([, t]) => t.pick || t.random));
    const out: AvatarSlot = {};
    if (Object.keys(pools).length) out.pools = pools;
    // 功能注释：空数组也要留下，表示「明确一个风格库都不选」；缺省才是全部官方风格库
    if (Array.isArray(n.stylePacks)) out.stylePacks = n.stylePacks.filter((x) => typeof x === "string" && !!x.trim());
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
  /** 功能注释：点「公共库优先」时一并展开官方风格库，方便立刻勾选 */
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
    !n ? "池名不能为空" : PUBLIC_AVATAR_NAMES.has(n) ? "与平台年龄档重名" : lib.some((p) => p.name === n && p.id !== self) ? "已有同名头像池" : "";
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
  const picked = Object.entries(v.pools ?? {}).filter(([, t]) => t.pick).map(([n]) => n);
  const missing = open ? enabled.filter((n) => !lib.some((p) => p.name === n)) : [];
  // 功能注释：没写过 stylePacks 时，名单里的风格库都显示为已选；改任意一个就写成明确 id 列表
  const styleSel = enabledStylePackIds(v);
  const styleOn = (id: string) => styleSel.all || styleSel.ids.has(id);
  const selectedStyleCount = styleSel.all ? styles.length : styles.filter((s) => styleSel.ids.has(s.id)).length;
  const toggleStyle = (id: string, on: boolean) => {
    const names = new Set(styleSel.all ? styles.map((s) => s.id) : [...styleSel.ids]);
    if (on) names.add(id); else names.delete(id);
    const ordered = [
      ...styles.map((s) => s.id).filter((n) => names.has(n)),
      ...[...names].filter((n) => !styles.some((s) => s.id === n)),
    ];
    emit({ ...v, stylePacks: ordered });
  };

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
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${picked.length ? "bg-ink text-paper" : "bg-ink/80 text-paper/95"}`}>
            {picked.length ? `已选 ${picked.length} 个` : "未选择"}
          </span>
          <span className="min-w-0 flex-1 truncate text-right text-[11px] text-ink-soft">{open ? `本机共 ${lib.length} 个池` : "展开后同步跨剧本头像库"}</span>
          <span className={`text-[12px] text-ink-soft transition ${open ? "rotate-90" : ""}`} aria-hidden>›</span>
        </button>
        {open && (
          <div className="space-y-2.5">
            <div>
              <p className="mb-1.5 text-[11px] text-ink-soft">玩家选用哪些池（可多选）。没勾的池，玩家选头像时看不到。</p>
              {lib.length > 0 ? (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="选择本剧让玩家使用的头像池">
                  {lib.map((p) => {
                    const on = !!v.pools?.[p.name]?.pick;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setToggle(p.name, { pick: !on })}
                        className={`rounded-full px-3 py-1 text-[12px] font-semibold ring-1 transition ${on ? "bg-ink text-paper ring-ink" : "bg-paper text-ink-soft ring-line hover:text-ink"}`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-line px-3 py-2 text-[12px] text-ink-soft">当前没有可选的池。先在下面新建，上传同一类人物的头像（建议正方形、脸在上半部），再点池名选用。</p>
              )}
            </div>
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
            {lib.map((p) => {
              const t = v.pools?.[p.name] ?? {};
              return (
                <div key={p.id} className="space-y-2 rounded-xl border border-line bg-paper p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input className={`${inp} !w-44 font-semibold`} defaultValue={p.name} key={p.name} aria-label="池名"
                      onBlur={(e) => { if (!rename(p, e.target.value)) e.target.value = p.name; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                    <span className="text-[11px] text-ink-soft">{p.images.length} 张</span>
                    <span className="flex-1" />
                    <Toggle on={!!t.pick} label="玩家选用" onChange={(x) => setToggle(p.name, { pick: x })} />
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

      {/* —— 官方风格库：默认收起，点标题展开后再勾选 —— */}
      <div className="space-y-2 border-t border-line/70 pt-3">
        <button type="button" onClick={() => setPublicOpen((o) => !o)} aria-expanded={publicOpen}
          className="flex w-full items-center gap-2 text-left">
          <span className={sub}>官方风格库</span>
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${selectedStyleCount ? "bg-ink text-paper" : "bg-ink/80 text-paper/95"}`}>
            {selectedStyleCount ? `已选 ${selectedStyleCount} 个` : "未选择"}
          </span>
          <span className="min-w-0 flex-1 truncate text-right text-[11px] text-ink-soft">
            {publicOpen ? "勾选本剧要用的风格，玩家和抽图都只走这些" : `点此选择${styles.map((s) => s.label).slice(0, 3).join(" / ") || "官方风格库"}`}
          </span>
          <span className={`text-[12px] text-ink-soft transition ${publicOpen ? "rotate-90" : ""}`} aria-hidden>›</span>
        </button>
        {publicOpen && (
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-ink-soft">只选画风。人物的性别和年龄会在这些图里自动对上。</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {styles.map((c) => {
                return (
                  <div key={c.id} className="rounded-lg border border-line bg-paper px-2.5 py-2">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        aria-haspopup="dialog"
                        onClick={() => setPreviewId(c.id)}
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-paper-2 text-[11px] font-bold text-ink-soft" aria-hidden>
                          {c.label.slice(0, 1)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] font-bold text-ink">{c.label}</div>
                          <div className="truncate text-[10.5px] text-ink-soft">{packCounts ? `${packCounts[c.id] ?? 0} 张 · 图源平台入库` : "官方风格库 · 图源平台入库"}</div>
                          <div className="text-[11px] font-semibold text-jade">预览头像池</div>
                        </div>
                      </button>
                      <Toggle on={styleOn(c.id)} label="使用" onChange={(x) => toggleStyle(c.id, x)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {previewId && (() => {
        const style = styles.find((item) => item.id === previewId);
        if (!style) return null;
        const preview = stylePackPreview(style.id);
        return (
          <Modal title={`${style.label} · 头像池`} onClose={() => zoom ? setZoom(null) : setPreviewId(null)}>
            {zoom ? (
              <div className="space-y-2">
                <img src={zoom.url} alt={zoom.title} className="max-h-[65vh] w-full rounded-xl object-contain" />
                <button type="button" className={btn} onClick={() => setZoom(null)}>返回头像池</button>
              </div>
            ) : (
            <div className="space-y-3">
              {!preview.ready && !packCounts && (
                <p className="text-[11.5px] text-ink-soft">头像还在加载，稍等一下再看。</p>
              )}
              {(preview.ready || packCounts) && preview.groups.length === 0 && (
                <p className="text-[11.5px] text-ink-soft">这个风格库还没有头像，玩家抽不到这个画风。</p>
              )}
              {preview.groups.map((g) => (
                <div key={g.id}>
                  <div className="mb-1 text-[10.5px] font-semibold text-ink-soft">{g.name} · {g.images.length} 张</div>
                  <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                    {g.images.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setZoom(img)}
                        aria-label={`放大查看 ${img.title}`}
                        className="aspect-square overflow-hidden rounded-lg border border-line bg-paper-2 transition hover:border-jade"
                      >
                        <img src={img.url} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            )}
          </Modal>
        );
      })()}
      {zoom && !previewId && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="头像预览"
          onClick={() => setZoom(null)}
        >
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-paper p-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.url} alt={zoom.title} className="max-h-[70vh] w-full rounded-xl object-contain bg-paper-2" />
            <div className="flex items-center gap-2 px-1 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{zoom.title}</span>
              <button type="button" className={btn} onClick={() => setZoom(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
