/**
 * 运营地点库 · 分层标点：先选「在哪张图上标」——大地图（封面）或某个地点的内部地图（innerMapUrl），
 * 再给该层的直接下级点位置，写回地点树 JSON 的 rooms[].mapX / mapY（百分比，相对所选那张图）。
 * 选地点 → 点图放置；拖动图钉微调；没选时点空白处新建该层地点。作者从地点库导入时点位与内部地图随之复制。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { getImageUrl } from '../../utils/constants';

type Node = { key: string; name: string; parentKey?: string | null; mapX?: number; mapY?: number; innerMapUrl?: string; [k: string]: unknown };

function useRatio(url: string): number {
  const [r, setR] = useState(9 / 16);
  useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.onload = () => { if (img.naturalWidth && img.naturalHeight) setR(img.naturalWidth / img.naturalHeight); };
    img.src = url;
  }, [url]);
  return r;
}

const round = (v: number) => Math.min(100, Math.max(0, Math.round(v * 10) / 10));

export default function LocationPinPlacer({ imageUrl, treeJsonText, onChange, onUpload }: {
  imageUrl: string;
  treeJsonText: string;
  onChange: (text: string) => void;
  /** 上传内部地图，返回图片地址 */
  onUpload?: (file: File) => Promise<string | null>;
}) {
  // 功能注释：当前标点层：'' = 大地图（封面），否则为某节点 key（在它的内部地图上标它的下级）
  const [level, setLevel] = useState('');
  const parsed = useMemo((): { rooms: Node[] } | null => {
    const raw = treeJsonText.trim();
    if (!raw) return { rooms: [] };
    try {
      const v = JSON.parse(raw) as { rooms?: unknown };
      return Array.isArray(v?.rooms) ? { ...(v as object), rooms: v.rooms as Node[] } : null;
    } catch {
      return null;
    }
  }, [treeJsonText]);
  const [sel, setSel] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: string; moved: boolean } | null>(null);
  const [temp, setTemp] = useState<{ key: string; x: number; y: number } | null>(null);
  const levelNode = parsed?.rooms.find((r) => r.key === level);
  const mapUrl = level ? String(levelNode?.innerMapUrl || '') : imageUrl;
  const ratio = useRatio(mapUrl ? getImageUrl(mapUrl) : '');

  if (!parsed) return <p style={{ fontSize: 12, color: 'var(--color-danger, #e5484d)' }}>地点树 JSON 格式有误，修正后才能在图上标点。</p>;
  const rooms = parsed.rooms;
  const tops = rooms.filter((r) => r && r.key && (level ? r.parentKey === level : !r.parentKey));

  const write = (next: Node[]) => onChange(JSON.stringify({ ...parsed, rooms: next }, null, 2));
  const setPos = (key: string, x: number | undefined, y: number | undefined) =>
    write(rooms.map((r) => (r.key === key ? { ...r, mapX: x, mapY: y } : r)));
  const pct = (cx: number, cy: number) => {
    const r = box.current!.getBoundingClientRect();
    return { x: round(((cx - r.left) / r.width) * 100), y: round(((cy - r.top) / r.height) * 100) };
  };

  const chip = (on: boolean, placed: boolean): React.CSSProperties => ({
    padding: '2px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
    border: `1px ${placed || on ? 'solid' : 'dashed'} ${on ? 'var(--color-primary)' : 'var(--color-border, rgba(255,255,255,.2))'}`,
    background: on ? 'var(--color-primary)' : 'transparent',
    color: on ? 'var(--color-on-primary, #fff)' : 'inherit',
  });

  const selNode = tops.find((r) => r.key === sel);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 12 }}>
        <span>标点层</span>
        <select
          value={level}
          onChange={(e) => { setLevel(e.target.value); setSel(null); }}
          style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--color-border, rgba(255,255,255,.2))', background: 'transparent', color: 'inherit' }}
        >
          <option value="">大地图（封面）· 顶层地点</option>
          {rooms.filter((r) => r?.key).map((r) => (
            <option key={r.key} value={r.key}>{r.name || r.key} 的内部地图 · 其子地点</option>
          ))}
        </select>
      </div>
      {level && levelNode ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 12 }}>
          <span>内部地图</span>
          <input
            value={String(levelNode.innerMapUrl || '')}
            placeholder="图片 URL，或右侧上传"
            onChange={(e) => write(rooms.map((r) => (r.key === level ? { ...r, innerMapUrl: e.target.value || undefined } : r)))}
            style={{ flex: 1, minWidth: 160, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--color-border, rgba(255,255,255,.2))', background: 'transparent', color: 'inherit' }}
          />
          {onUpload ? (
            <input type="file" accept="image/*" onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const url = await onUpload(f);
              if (url) write(rooms.map((r) => (r.key === level ? { ...r, innerMapUrl: url } : r)));
            }} />
          ) : null}
        </div>
      ) : null}
      <span style={{ fontSize: 12, opacity: 0.75 }}>选地点后点图放置，拖动图钉微调；不选时点空白处新建本层地点。</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tops.map((r) => {
          const placed = typeof r.mapX === 'number' && typeof r.mapY === 'number';
          return (
            <button key={r.key} type="button" style={chip(sel === r.key, placed)} onClick={() => setSel(sel === r.key ? null : r.key)}>
              {r.name || r.key}{placed ? '' : ' · 未放'}
            </button>
          );
        })}
        {!tops.length ? <span style={{ fontSize: 12, opacity: 0.6 }}>本层还没有地点，点图上任意位置即可新建。</span> : null}
      </div>
      {selNode ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
          <span>名称</span>
          <input
            value={selNode.name}
            onChange={(e) => write(rooms.map((r) => (r.key === selNode.key ? { ...r, name: e.target.value } : r)))}
            style={{ flex: 1, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--color-border, rgba(255,255,255,.2))', background: 'transparent', color: 'inherit' }}
          />
          {typeof selNode.mapX === 'number' ? (
            <button type="button" style={chip(false, true)} onClick={() => setPos(selNode.key, undefined, undefined)}>移除点位</button>
          ) : null}
        </div>
      ) : null}
      {!mapUrl ? <p style={{ fontSize: 12, opacity: 0.6 }}>先上传「{levelNode?.name || ''}」的内部地图，才能给它的子地点标点。</p> : (
      <div
        ref={box}
        style={{ position: 'relative', width: ratio >= 1 ? 'min(100%, 520px)' : 'min(100%, 300px)', aspectRatio: String(ratio), borderRadius: 12, overflow: 'hidden', touchAction: 'none', userSelect: 'none', cursor: sel ? 'crosshair' : 'copy', background: `#222 url(${getImageUrl(mapUrl)}) center / cover no-repeat` }}
        onPointerDown={(e) => {
          const key = (e.target as HTMLElement).closest('[data-pin]')?.getAttribute('data-pin');
          if (key) { setSel(key); drag.current = { key, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); }
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          d.moved = true;
          setTemp({ key: d.key, ...pct(e.clientX, e.clientY) });
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          const p = pct(e.clientX, e.clientY);
          if (d) { if (d.moved) setPos(d.key, p.x, p.y); setTemp(null); return; }
          if (selNode) { setPos(selNode.key, p.x, p.y); setSel(null); return; }
          const key = `p_${Date.now().toString(36)}`;
          write([...rooms, { key, name: '新地点', parentKey: level || null, description: '你来到了「新地点」。', mapX: p.x, mapY: p.y }]);
          setSel(key);
        }}
      >
        {tops.filter((r) => typeof r.mapX === 'number' && typeof r.mapY === 'number').map((r) => {
          const pos = temp?.key === r.key ? temp : { x: r.mapX!, y: r.mapY! };
          const on = sel === r.key;
          return (
            <span key={r.key} data-pin={r.key} style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'grab', zIndex: on ? 2 : 1 }}>
              <span style={{ whiteSpace: 'nowrap', padding: '1px 6px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: on ? 'var(--color-primary)' : 'rgba(0,0,0,.65)', color: '#fff' }}>{r.name || r.key}</span>
              <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #fff', background: on ? 'var(--color-primary)' : '#2fbf8f' }} />
            </span>
          );
        })}
      </div>
      )}
    </div>
  );
}
