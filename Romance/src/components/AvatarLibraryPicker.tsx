import { useEffect, useMemo, useState } from "react";
import { Modal } from "./ui";
import {
  AVATAR_POOLS_EVENT,
  assetIdForAvatarUrl,
  creatorPickPools,
  enabledStylePackIds,
  platformPoolsForSlot,
  setPlatformSystemPoolsCache,
  type AvatarSource,
} from "../game/avatarPools";
import {
  fetchPlatformStylePackOptions,
  fetchPlatformSystemAvatarPools,
  listCachedStylePackIds, listCachedBackgroundIds, AVATAR_BACKGROUND_OPTIONS,
  PLATFORM_AVATAR_GROUPS,
  type PlatformStylePackOption,
} from "../lib/platformAvatarLibrary";
import type { AvatarSlot } from "../lib/types";
import AiImageGen, { type AiImageGenPhase } from "./AiImageGen";
import { NPC_AVATAR_GEN_SIZE } from "../lib/editorImagePrompts";

/* 游玩端头像选择：本地上传 / 创作者头像库 / 系统头像库 / AI 生图；点头像即使用；系统库支持风格包/标签筛选 */
type Tab = "creator" | "system" | "gen";

const GENDER_FILTERS = [
  { id: "", label: "全部性别" },
  { id: "female", label: "女" },
  { id: "male", label: "男" },
] as const;

const AGE_FILTERS = [
  { id: "", label: "全部年龄" },
  { id: "child", label: "幼年" },
  { id: "adult", label: "成年" },
  { id: "elder", label: "老年" },
] as const;

function poolMatchesFilters(pool: AvatarSource, gender: string, age: string): boolean {
  if (!gender && !age) return true;
  const meta = PLATFORM_AVATAR_GROUPS.find((g) => g.name === pool.name);
  if (!meta) {
    // 创作者池 / 未分桶：无三维标签时，选了筛选则默认仍展示（避免误伤）
    return !gender && !age ? true : tabIsLoosePool(pool);
  }
  if (gender && meta.gender !== gender) return false;
  if (age && meta.ageGroup !== age) return false;
  return true;
}

/** 无平台三维元数据的池（创作者自定义名等）在筛选开启时仍可见 */
function tabIsLoosePool(pool: AvatarSource): boolean {
  return pool.source === "mine" || !PLATFORM_AVATAR_GROUPS.some((g) => g.name === pool.name);
}

export default function AvatarLibraryPicker({ name, current, onPick, onUpload, onClose, slot, taken }: {
  name: string; current?: string; onPick: (url: string) => void; onUpload: () => void; onClose: () => void;
  slot?: AvatarSlot | null;
  /** 本剧已经用过的头像键（u:地址 / id:条目）。当前这个人自己的不传进来 */
  taken?: ReadonlySet<string>;
}) {
  const [rev, bump] = useState(0);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState("");
  /** 功能注释：当前选中（点头像即回写 onPick）*/
  const [selected, setSelected] = useState(current || "");
  const [styleFilter, setStyleFilter] = useState("");
  const [bgFilter, setBgFilter] = useState("");
  const [styleOptions, setStyleOptions] = useState<PlatformStylePackOption[]>([]);
  const [genderFilter, setGenderFilter] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [genPhase, setGenPhase] = useState<AiImageGenPhase>("edit");
  /** 功能注释：空字符串 = 当前页全部池；否则只看玩家点中的那一个池 */
  const [poolPick, setPoolPick] = useState("");

  useEffect(() => {
    const h = () => bump((n) => n + 1);
    window.addEventListener(AVATAR_POOLS_EVENT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(AVATAR_POOLS_EVENT, h); window.removeEventListener("storage", h); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSystemLoading(true);
    setSystemError("");
    void fetchPlatformStylePackOptions().then((styles) => {
      if (!cancelled) setStyleOptions(styles);
    });
    void fetchPlatformSystemAvatarPools()
      .then((pools) => {
        if (cancelled) return;
        setPlatformSystemPoolsCache(pools);
        if (!pools.length) setSystemError("平台头像库暂无上架头像，请到仓库「头像库」或运营「公共头像」入库。");
      })
      .catch((e) => {
        if (cancelled) return;
        setSystemError((e as Error)?.message || "加载平台头像库失败");
      })
      .finally(() => {
        if (!cancelled) setSystemLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const creator = creatorPickPools(slot);
  // 功能注释：系统库按本剧勾选的官方风格库收图，再按性别年龄分桶；浏览筛选不改全局抽图缓存
  const system = useMemo(
    () => platformPoolsForSlot(slot, { stylePack: styleFilter, background: bgFilter }),
    [slot, styleFilter, bgFilter, systemLoading, rev],
  );
  const [tab, setTab] = useState<Tab>(creator.length ? "creator" : "system");
  const tabPools: AvatarSource[] = tab === "creator" ? creator : tab === "system" ? system : [];
  const poolNames = useMemo(() => [...new Set(tabPools.map((p) => p.name))], [tabPools]);
  const pickedPools = poolPick && poolNames.includes(poolPick) ? tabPools.filter((p) => p.name === poolPick) : tabPools;
  const pools: AvatarSource[] = pickedPools;
  const filteredPools = useMemo(
    () => (tab === "system" ? pools.filter((p) => poolMatchesFilters(p, genderFilter, ageFilter)) : pools),
    [tab, pools, genderFilter, ageFilter],
  );
  // 功能注释：风格 = 运营配置的风格包 ∪ 头像数据里实际出现的风格包（后台没配名字的也能筛）
  const styleFilters = useMemo(() => {
    const present = listCachedStylePackIds();
    const sel = enabledStylePackIds(slot);
    const list = [...styleOptions];
    for (const id of present) if (!list.some((o) => o.id === id)) list.push({ id, label: id });
    const allowed = sel.all ? list : list.filter((o) => sel.ids.has(o.id));
    return [{ id: "", label: "全部风格" }, ...allowed];
  }, [styleOptions, slot, systemLoading, rev]);
  // 功能注释：时代（古代 / 现代 / 西幻）筛选——后台头像库的背景类型维度
  const bgFilters = useMemo(() => {
    const present = new Set(listCachedBackgroundIds());
    const list = AVATAR_BACKGROUND_OPTIONS.filter((o) => !present.size || present.has(o.id));
    return [{ id: "", label: "全部时代" }, ...list];
  }, [system]);
  const tabs: { k: Tab; l: string; n?: number }[] = [
    { k: "creator", l: "创作者头像库", n: creator.reduce((a, p) => a + (p.images?.length ?? 0), 0) },
    { k: "system", l: "系统头像库", n: system.reduce((a, p) => a + (p.images?.length ?? 0), 0) },
    { k: "gen", l: "生图" },
  ];


  const genBusy = tab === "gen" && genPhase === "busy";

  return (
    <Modal
      title={tab === "gen" ? (genPhase === "done" ? `「${name}」头像 · 生成结果` : `AI 生成「${name}」头像`) : `选择${name}的头像`}
      onClose={onClose}
      locked={genBusy}
      panelClassName={tab === "gen" ? "max-w-[28rem]" : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1 rounded-2xl bg-[#f6f1ef] p-1 ring-1 ring-black/5">
          {tabs.map((t) => (
            <button
              key={t.k}
              type="button"
              disabled={genBusy && t.k !== "gen"}
              onClick={() => { setTab(t.k); setPoolPick(""); if (t.k !== "gen") setGenPhase("edit"); }}
              className={`rounded-xl px-3 py-1.5 text-[12px] font-bold transition disabled:opacity-40 ${
                tab === t.k
                  ? "bg-white text-[color:var(--jade)] shadow-[0_1px_3px_rgba(40,20,30,0.12)] ring-1 ring-[color:var(--jade)]/25"
                  : "text-ink-soft hover:bg-white/70 hover:text-ink"
              }`}
            >
              {t.l}{t.n != null ? <span className="ml-1 font-semibold opacity-60">{t.n}</span> : null}
            </button>
          ))}
        </div>
        {tab !== "gen" && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={onUpload}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:border-[color:var(--jade)] hover:text-[color:var(--jade)]"
              title="支持裁切与预览，非 1:1 须裁切后使用"
            >本地上传</button>
          </div>
        )}
      </div>
      {tab === "creator" && poolNames.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="选择头像池">
          {poolNames.length > 1 && (
            <button
              type="button"
              aria-pressed={!poolPick}
              onClick={() => setPoolPick("")}
              className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 transition ${!poolPick ? "bg-ink text-paper ring-ink" : "bg-paper text-ink-soft ring-line hover:text-ink"}`}
            >
              全部
            </button>
          )}
          {poolNames.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={poolPick === n || (poolNames.length === 1 && !poolPick)}
              onClick={() => setPoolPick(poolNames.length === 1 ? n : (poolPick === n ? "" : n))}
              className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 transition ${poolPick === n || (poolNames.length === 1 && !poolPick) ? "bg-ink text-paper ring-ink" : "bg-paper text-ink-soft ring-line hover:text-ink"}`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {tab === "gen" ? (
        <div className="mt-2">
          {/* 功能注释：扣费金额由 AiImageGen 按线路单价展示 */}
          {/* 功能注释：禁止 autoRun——进「生成图」只编辑，须玩家点「开始生成」才扣费出图 */}
          <AiImageGen
            bare
            size={NPC_AVATAR_GEN_SIZE}
            placeholder="描述头像：性别、年龄感、发型、面容、衣着、表情……"
            initialPrompt=""
            initialRefs={current ? [current] : undefined}
            autoRun={false}
            autoApply={false}
            onPhaseChange={setGenPhase}
            onPick={(url) => onPick(url)}
          />
        </div>
      ) : (
        <>
          {tab === "system" ? (
            <div className="mt-3 space-y-2 rounded-xl border border-line bg-paper px-3 py-2.5">
              <p className="text-[11px] font-bold tracking-wide text-ink-soft">标签筛选</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="风格包筛选">
                {styleFilters.map((f) => (
                  <button
                    key={f.id || "s-all"}
                    type="button"
                    onClick={() => setStyleFilter(f.id)}
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition ${styleFilter === f.id ? "bg-jade/15 text-jade ring-1 ring-jade/40" : "bg-paper-2 text-ink-soft ring-1 ring-line hover:text-ink"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="时代筛选">
                {bgFilters.map((f) => (
                  <button
                    key={f.id || "b-all"}
                    type="button"
                    onClick={() => setBgFilter(f.id)}
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition ${bgFilter === f.id ? "bg-jade/15 text-jade ring-1 ring-jade/40" : "bg-paper-2 text-ink-soft ring-1 ring-line hover:text-ink"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="性别筛选">
                {GENDER_FILTERS.map((f) => (
                  <button
                    key={f.id || "g-all"}
                    type="button"
                    onClick={() => setGenderFilter(f.id)}
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition ${genderFilter === f.id ? "bg-jade/15 text-jade ring-1 ring-jade/40" : "bg-paper-2 text-ink-soft ring-1 ring-line hover:text-ink"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="年龄筛选">
                {AGE_FILTERS.map((f) => (
                  <button
                    key={f.id || "a-all"}
                    type="button"
                    onClick={() => setAgeFilter(f.id)}
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition ${ageFilter === f.id ? "bg-jade/15 text-jade ring-1 ring-jade/40" : "bg-paper-2 text-ink-soft ring-1 ring-line hover:text-ink"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "system" && systemLoading && !pools.length ? (
            <p className="mt-6 rounded-xl border border-dashed border-line px-4 py-8 text-center text-[12.5px] text-ink-soft">
              正在加载平台头像库…
            </p>
          ) : tab === "system" && systemError && !pools.length ? (
            <p className="mt-6 rounded-xl border border-dashed border-line px-4 py-8 text-center text-[12.5px] leading-relaxed text-ink-soft">
              {systemError}
            </p>
          ) : !pools.length ? (
            <p className="mt-6 rounded-xl border border-dashed border-line px-4 py-8 text-center text-[12.5px] leading-relaxed text-ink-soft">
              {tab === "creator" ? "这个剧本还没有勾选玩家能用的头像池。可以去「系统头像库」挑，或用「生图」/本地上传。" : "这个剧本还没有勾选官方风格库。可以换「创作者头像库」，或用「生图」/本地上传。"}
            </p>
          ) : !filteredPools.length ? (
            <p className="mt-6 rounded-xl border border-dashed border-line px-4 py-8 text-center text-[12.5px] text-ink-soft">
              当前标签下没有头像，试试换一组筛选。
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {filteredPools.flatMap((p) =>
                (Array.isArray(p.images) ? p.images : []).filter((url) => {
                  if (!taken?.size) return true;
                  if (taken.has(`u:${url}`)) return false;
                  const id = assetIdForAvatarUrl(url);
                  return !(id && taken.has(`id:${id}`));
                }).map((url, i) => (
                  <button
                    key={`${p.source}:${p.name}:${url}:${i}`}
                    type="button"
                    // 功能注释：点头像即使用，不用再回到顶部点「保存」
                    onClick={() => { setSelected(url); onPick(url); }}
                    aria-label={`${p.name} 第 ${i + 1} 张`}
                    aria-pressed={selected === url}
                    className={`aspect-square overflow-hidden rounded-[10px] border bg-paper-2 transition hover:-translate-y-0.5 hover:shadow-md ${selected === url ? "border-jade ring-2 ring-jade/50" : "border-line hover:border-jade"}`}
                  >
                    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover object-center" />
                  </button>
                )),
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
