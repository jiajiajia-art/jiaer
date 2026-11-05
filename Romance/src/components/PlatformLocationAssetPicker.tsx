/**
 * 地点素材库弹窗：只选图填进当前预览，不改地点名/描述/树结构。
 * 与地点库整包弹窗分离。
 */
import { useEffect, useState } from "react";
import { Modal } from "./ui";
import { EmptyState, SearchBox } from "./EditorKit";
import {
  LOCATION_ASSET_PURPOSE_LABEL,
  listActivePlatformLocationAssets,
  resolvePlatformLocationAssetUrl,
  type LocationAssetPurpose,
  type PlatformLocationAssetItem,
} from "../lib/platformLocationAssetLibrary";

export default function PlatformLocationAssetPicker({
  purpose,
  onPick,
  onClose,
}: {
  purpose: LocationAssetPurpose;
  onPick: (imageUrl: string, item: PlatformLocationAssetItem) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState<PlatformLocationAssetItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr("");
    void listActivePlatformLocationAssets({ q, purpose })
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch((e) => { if (!cancelled) { setItems([]); setErr(e instanceof Error ? e.message : "加载失败"); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q, purpose]);

  return (
    <Modal title={`素材库 · ${LOCATION_ASSET_PURPOSE_LABEL[purpose]}`} onClose={onClose}>
      <p className="mb-2 text-[12px] leading-relaxed text-ink-soft">
        只换当前预览图，不会改地点名称、场景描述或地点树。下架素材不会出现。
      </p>
      <SearchBox value={q} onChange={setQ} placeholder="搜索名称 / 作者库兰号 / 标签" />
      {err ? <p className="mt-2 text-[12px] text-danger">{err}</p> : null}
      {loading ? <p className="mt-3 text-[12px] text-ink-soft">加载中…</p> : null}
      {!loading && !err && !items.length ? (
        <EmptyState>该用途下暂无上架素材，请联系运营在后台上传。</EmptyState>
      ) : null}
      <ul className="mt-2 grid max-h-[22rem] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
        {items.map((item) => {
          const img = resolvePlatformLocationAssetUrl(item.imageUrl);
          return (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full flex-col overflow-hidden rounded-xl border border-line bg-paper text-left transition hover:border-jade"
                onClick={() => onPick(img || item.imageUrl, item)}
              >
                {img ? (
                  <img src={img} alt="" className="aspect-[9/16] w-full object-cover" />
                ) : (
                  <span className="aspect-[9/16] w-full bg-paper-2" />
                )}
                <span className="truncate px-1.5 py-1 text-[11px] font-semibold text-ink">{item.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
