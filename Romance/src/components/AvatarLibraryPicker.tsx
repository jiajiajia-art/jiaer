import { useEffect, useMemo, useState } from "react";
import { Modal } from "./ui";
import {
  AVATAR_POOLS_EVENT,
  creatorPickPools,
  setPlatformSystemPoolsCache,
  systemPools,
  type AvatarSource,
} from "../game/avatarPools";
import {
  fetchPlatformStylePackOptions,
  fetchPlatformSystemAvatarPools,
  getCachedPlatformAvatarItems,
  listCachedStylePackIds,
  regroupCachedPlatformAvatarPools,
  PLATFORM_AVATAR_GROUPS,
  type PlatformStylePackOption,
} from "../lib/platformAvatarLibrary";
import type { AvatarSlot } from "../lib/types";
import AiImageGen, { type AiImageGenPhase } from "./AiImageGen";
import { NPC_AVATAR_GEN_SIZE } from "../lib/editorImagePrompts";

/* 游玩端头像选择：本地上传 / 创作者头像库 / 系统头像库 / AI 生图；点选后保存；系统库支持风格包/标签筛选 */
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

export default function AvatarLibraryPicker({ name, current, onPick, onUpload, onClose, slot }: {
  name: string; current?: string; onPick: (url: string) => void; onUpload: () => void; onClose: () => void;
  slot?: AvatarSlot | null;
}) {
  const [, bump] = useState(0);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState("");
  /** 功能注释：点选仅高亮，点「保存」才回写；避免误点立刻关闭 */
  const [selected, setSelected] = useState(current || "");
  const [styleFilter, setStyleFilter] = useState("");
  const [styleOptions, setStyleOptions] = useState<PlatformStylePackOption[]>([]);
  const [genderFilter, setGenderFilter] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [genPhase, setGenPhase] = useState<AiImageGenPhase>("edit");

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
    void Promise.all([
      fetchPlatformSystemAvatarPools(),
      fetchPlatformStylePackOptions(),
    ])
      .then(([pools, styles]) => {
        if (cancelled) return;
        setPlatformSystemPoolsCache(pools);
        setStyleOptions(styles);
        if (!pools.length) setSystemError("平台头像库暂无上架头像，请到仓库「头像库」或运营「公共头像」入库。");
      })
      .catch((e) => {
        if (cancelled) return;
        setPlatformSystemPoolsCache([]);
        setSystemError((e as Error)?.message || "加载平台头像库失败");
      })
      .finally(() => {
        if (!cancelled) setSystemLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // 功能注释：风格包切换走本地缓存重分组；首屏缓存未就绪时跳过，避免空覆盖
    if (!getCachedPlatformAvatarItems().length) return;
    setPlatformSystemPoolsCache(regroupCachedPlatformAvatarPools(styleFilter));
  }, [styleFilter]);

  const creator = creatorPickPools(slot);
  const system = systemPools();
  const [tab, setTab] = useState<Tab>(creator.length ? "creator" : "system");
  const pools: AvatarSource[] = tab === "creator" ? creator : tab === "system" ? system : [];
  const filteredPools = useMemo(
    () => (tab === "system" ? pools.filter((p) => poolMatchesFilters(p, genderFilter, ageFilter)) : pools),
    [tab, pools, genderFilter, ageFilter],
  );
  const styleFilters = useMemo(() => {
    const present = new Set(listCachedStylePackIds());
    const fromApi = styleOptions.filter((o) => !present.size || present.has(o.id));
    const list = fromApi.length ? fromApi : styleOptions;
    return [{ id: "", label: "全部风格" }, ...list];
  }, [styleOptions, system]);
  const tabs: { k: Tab; l: string; n?: number }[] = [
    { k: "creator", l: "创作者头像库", n: creator.reduce((a, p) => a + (p.images?.length ?? 0), 0) },
    { k: "system", l: "系统头像库", n: system.reduce((a, p) => a + (p.images?.length ?? 0), 0) },
    { k: "gen", l: "生图" },
  ];

  const save = () => {
    if (!selected) return;
    onPick(selected);
  };

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
              onClick={() => { setTab(t.k); if (t.k !== "gen") setGenPhase("edit"); }}
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
            <button
              type="button"
              disabled={!selected}
              onClick={save}
              className="rounded-full bg-[color:var(--jade)] px-3.5 py-1.5 text-[12px] font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
              title={selected ? "保存当前选中的头像" : "请先点选一张头像"}
            >
              保存
            </button>
            <button type="button" onClick={onUpload}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:border-[color:var(--jade)] hover:text-[color:var(--jade)]"
              title="支持裁切与预览，非 1:1 须裁切后使用"
            >本地上传</button>
          </div>
        )}
      </div>

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
            assetKind="avatar"
            assetName={`${name || "人物"}头像`}
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

          {tab === "system" && systemLoading ? (
            <p className="mt-6 rounded-xl border border-dashed border-line px-4 py-8 text-center text-[12.5px] text-ink-soft">
              正在加载平台头像库…
            </p>
          ) : tab === "system" && systemError && !pools.length ? (
            <p className="mt-6 rounded-xl border border-dashed border-line px-4 py-8 text-center text-[12.5px] leading-relaxed text-ink-soft">
              {systemError}
            </p>
          ) : !pools.length ? (
            <p className="mt-6 rounded-xl border border-dashed border-line px-4 py-8 text-center text-[12.5px] leading-relaxed text-ink-soft">
              {tab === "creator" ? "这个剧本的作者还没有开放头像池。可以去「系统头像库」挑，或用「生图」/本地上传。" : "系统头像库暂时为空。"}
            </p>
          ) : !filteredPools.length ? (
            <p className="mt-6 rounded-xl border border-dashed border-line px-4 py-8 text-center text-[12.5px] text-ink-soft">
              当前标签下没有头像，试试换一组筛选。
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {filteredPools.flatMap((p) =>
                (Array.isArray(p.images) ? p.images : []).map((url, i) => (
                  <button
                    key={`${p.source}:${p.name}:${url}:${i}`}
                    type="button"
                    onClick={() => setSelected(url)}
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
