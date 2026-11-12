import { ASSET_KINDS, ASSET_KIND_LABEL, assetKindOf, type Asset, type AssetKind } from "../lib/freeStyle"

export type AssetKindFilter = "all" | AssetKind

/** 功能注释：素材库分类筛选（全部 / 头像 / 地点 / 封面 / 其他），素材库面板与图片选择器共用 */
export default function AssetKindTabs({
  assets,
  value,
  onChange,
}: {
  assets: Asset[]
  value: AssetKindFilter
  onChange: (v: AssetKindFilter) => void
}) {
  const count = (k: AssetKindFilter) => (k === "all" ? assets.length : assets.filter((a) => assetKindOf(a) === k).length)
  return (
    <div className="flex flex-wrap gap-1" role="tablist" aria-label="素材分类">
      {(["all", ...ASSET_KINDS] as AssetKindFilter[]).map((k) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={value === k}
          onClick={() => onChange(k)}
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
            value === k ? "border-jade bg-jade/10 text-jade" : "border-line bg-paper text-ink-soft hover:text-ink"
          }`}
        >
          {k === "all" ? "全部" : ASSET_KIND_LABEL[k]}
          <span className="ml-1 opacity-60">{count(k)}</span>
        </button>
      ))}
    </div>
  )
}

export function filterAssetsByKind(assets: Asset[], f: AssetKindFilter): Asset[] {
  return f === "all" ? assets : assets.filter((a) => assetKindOf(a) === f)
}
