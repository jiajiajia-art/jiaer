import type { CoverCgOpts } from "../mods/types";
import ImagePicker, { type ImagePickerAiGen } from "./ImagePicker";

/* 封面轮播 CG 编辑：缩略图排序 / 删除 / 添加 + 停留时长 · 切换效果 · 随机 · 页码点。
 * 玩家封面 DIY 与模组「开局封面」共用。 */
export const CG_MAX = 12;
const chip = (on: boolean) => `rounded-[6px] border px-2.5 py-1.5 text-[12px] transition ${on ? "border-jade bg-jade/10 font-bold text-jade" : "border-line bg-paper text-ink hover:border-jade/60"}`;
const mini = "grid h-6 w-6 place-items-center rounded-md bg-black/55 text-[12px] leading-none text-white backdrop-blur-sm transition hover:bg-black/75 disabled:opacity-30";
const FX = [["fade", "淡入淡出"], ["slide", "左右滑动"], ["zoom", "缓推（电影感）"]] as const;

export default function CoverCgEditor({ v, set, aiGen }: { v: CoverCgOpts; set: (p: Partial<CoverCgOpts>) => void; /** 功能注释：透传给添加图的 ImagePicker，弹窗生图而非页内输入框 */ aiGen?: ImagePickerAiGen }) {
  const list = v.cgs ?? [];
  const put = (l: string[]) => set({ cgs: l.length ? l : undefined });
  const move = (i: number, d: -1 | 1) => { const l = [...list]; [l[i], l[i + d]] = [l[i + d], l[i]]; put(l); };
  const sec = v.cgInterval ?? 6;

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 flex items-baseline justify-between text-[12px] font-bold text-ink">
          轮播 CG<span className="text-[10.5px] font-normal text-ink-soft">{list.length} / {CG_MAX} 张 · 按顺序播放</span>
        </p>
        {list.length > 0 && (
          <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {list.map((src, i) => (
              <li key={`${i}-${src.length}`} className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-line bg-paper-2">
                <img src={src} alt={`第 ${i + 1} 张`} className="h-full w-full object-cover" />
                <span className="absolute left-1 top-1 rounded-md bg-black/55 px-1.5 text-[10.5px] font-bold tabular-nums text-white">{i + 1}</span>
                <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <span className="flex gap-1">
                    <button type="button" className={mini} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`第 ${i + 1} 张前移`}>‹</button>
                    <button type="button" className={mini} disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={`第 ${i + 1} 张后移`}>›</button>
                  </span>
                  <button type="button" className={`${mini} hover:!bg-danger`} onClick={() => put(list.filter((_, k) => k !== i))} aria-label={`删除第 ${i + 1} 张`}>×</button>
                </div>
              </li>
            ))}
          </ol>
        )}
        {list.length < CG_MAX && (
          <div className="mt-2">
            <ImagePicker label="轮播 CG" max={1600} onChange={(u) => u && put([...list, u])}
              hint={list.length < 2 ? `再添加 ${2 - list.length} 张即可轮播；只有一张时按固定 CG 显示` : "继续添加；悬停缩略图可用 ‹ › 调整顺序"}
              aiGen={aiGen} />
          </div>
        )}
        {list.length >= 6 && <p className="mt-1 text-[10.5px] text-ink-soft">图片较多时会占用较多本地存储；没有图床的话，可以用「链接」添加网络图片。</p>}
      </div>

      <div>
        <p className="mb-1 flex items-center justify-between text-[12px] font-bold text-ink">每张停留<span className="tabular-nums text-ink-soft">{sec} 秒</span></p>
        <input type="range" min={3} max={20} value={sec} onChange={(e) => set({ cgInterval: +e.target.value === 6 ? undefined : +e.target.value })} className="w-full accent-[var(--jade)]" aria-label="每张停留秒数" />
      </div>
      <div>
        <p className="mb-1.5 text-[12px] font-bold text-ink">切换效果</p>
        <div className="flex flex-wrap gap-1.5">
          {FX.map(([k, l]) => <button key={k} type="button" aria-pressed={(v.cgFx ?? "fade") === k} onClick={() => set({ cgFx: k === "fade" ? undefined : k })} className={chip((v.cgFx ?? "fade") === k)}>{l}</button>)}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-ink">
        <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-[var(--jade)]" checked={!!v.cgShuffle} onChange={(e) => set({ cgShuffle: e.target.checked || undefined })} />随机顺序</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-[var(--jade)]" checked={!v.cgHideDots} onChange={(e) => set({ cgHideDots: e.target.checked ? undefined : true })} />显示底部页码点（可点击切换）</label>
      </div>
      <p className="text-[10.5px] text-ink-soft">系统开启「减少动态效果」时，统一改为柔和淡入淡出。</p>
    </div>
  );
}
