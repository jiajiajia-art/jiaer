import { useEffect, useMemo, useState } from "react";
import { Modal } from "./ui";
import {
  AVATAR_POOLS_EVENT,
  creatorPickPools,
  setPlatformSystemPoolsCache,
  systemPools,
  type AvatarSource,
} from "../game/avatarPools";
import { fetchPlatformSystemAvatarPools, PLATFORM_AVATAR_GROUPS } from "../lib/platformAvatarLibrary";
import type { AvatarSlot } from "../lib/types";

/* 游玩端头像选择：本地上传 / 创作者头像库 / 系统头像库；点选后保存；系统库支持标签筛选 */
type Tab = "creator" | "system";

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
  const [genderFilter, setGenderFilter] = useState("");
  const [ageFilter, setAgeFilter] = useState("");

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
    void fetchPlatformSystemAvatarPools()
      .then((pools) => {
        if (cancelled) return;
        setPlatformSystemPoolsCache(pools);
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

  const creator = creatorPickPools(slot);
  const system = systemPools();
  const [tab, setTab] = useState<Tab>(creator.length ? "creator" : "system");
  const pools: AvatarSource[] = tab === "creator" ? creator : system;
  const filteredPools = useMemo(
    () => (tab === "system" ? pools.filter((p) => poolMatchesFilters(p, genderFilter, ageFilter)) : pools),
    [tab, pools, genderFilter, ageFilter],
  );
  const tabs: { k: Tab; l: string; n: number }[] = [
    { k: "creator", l: "创作者头像库", n: creator.reduce((a, p) => a + (p.images?.length ?? 0), 0) },
    { k: "system", l: "系统头像库", n: system.reduce((a, p) => a + (p.images?.length ?? 0), 0) },
  ];

  const save = () => {
    if (!selected) return;
    onPick(selected);
  };

  return (
    <Modal title={`选择${name}的头像`} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex rounded-full bg-paper p-0.5 ring-1 ring-line">
          {tabs.map((t) => (
            <button key={t.k} type="button" onClick={() => setTab(t.k)}
              className={`rounded-full px-3 py-1 text-[12px] font-bold transition ${tab === t.k ? "bg-jade text-white shadow" : "text-ink-soft hover:text-ink"}`}>
              {t.l}<span className="ml-1 font-normal opacity-75">{t.n}</span>
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <button
          type="button"
          disabled={!selected}
          onClick={save}
          className="rounded-full bg-jade px-3.5 py-1 text-[12px] font-bold text-white shadow transition disabled:cursor-not-allowed disabled:opacity-40"
          title={selected ? "保存当前选中的头像" : "请先点选一张头像"}
        >
          保存
        </button>
        <button type="button" onClick={onUpload}
          className="rounded-full border border-line bg-paper px-3 py-1 text-[12px] font-semibold text-ink transition hover:border-jade hover:text-jade"
          title="支持裁切与预览，非 1:1 须裁切后使用"
        >从本地上传</button>
      </div>

      {tab === "system" ? (
        <div className="mt-3 space-y-2 rounded-xl border border-line bg-paper px-3 py-2.5">
          <p className="text-[11px] font-bold tracking-wide text-ink-soft">标签筛选</p>
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
          {tab === "creator" ? "这个剧本的作者还没有开放头像池。可以去「系统头像库」挑，或直接从本地上传。" : "系统头像库暂时为空。"}
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
    </Modal>
  );
}
