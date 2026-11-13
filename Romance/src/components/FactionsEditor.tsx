import type { StartFaction } from "../game/data";

/**
 * 功能注释：作品势力表（creation.startFactions）。
 * 建好后：人物卡可选「所属势力」→ 人物资料显示、对话提示词带上、事件条件可选「人物所属势力」与「阵营声望」。
 * 势力范围：勾选控制的地点 → 对话提示词说明此地归属、事件条件可选「当前地点属于某势力范围」。
 */
const inp = "w-full min-w-0 rounded-xl border border-line bg-paper-2 px-3 py-1.5 text-[12.5px] text-ink placeholder:text-ink-soft/55 transition focus:border-jade focus:outline-none focus:ring-2 focus:ring-jade/20";
const btn = "inline-flex items-center gap-1 rounded-full border border-line bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const uid = () => `fac_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;

export default function FactionsEditor({ value, memberCount, repOn, rooms = [], onChange }: {
  value: StartFaction[];
  /** 功能注释：作品地点（含上级 parent），用于勾选势力范围 */
  rooms?: { id: string; name: string; parent?: string }[];
  /** 功能注释：已添加「阵营声望」玩法才显示初始声望 */
  repOn: boolean;
  /** 功能注释：每个势力当前有几位人物归属，删除前提示 */
  memberCount: (id: string) => number;
  onChange: (next: StartFaction[] | undefined) => void;
}) {
  const set = (i: number, p: Partial<StartFaction>) => onChange(value.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const commit = (next: StartFaction[]) => onChange(next.length ? next : undefined);
  return (
    <div className="space-y-2">
      {!value.length && (
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] leading-relaxed text-ink-soft">
          还没有势力。建好后可以在人物卡里选「所属势力」、给势力划定地点范围，游戏里的人物资料、对话和事件条件都会用到。
        </p>
      )}
      {value.map((f, i) => {
        const n = memberCount(f.id);
        return (
          <div key={f.id} className="space-y-2 rounded-2xl border border-line bg-paper p-3">
            <div className="flex items-center gap-2">
              <input className={`${inp} font-semibold`} value={f.name} placeholder="势力名，如：如归宾馆 / 青云门 / 警局" maxLength={24} onChange={(e) => set(i, { name: e.target.value })} aria-label="势力名" />
              <span className="shrink-0 rounded-full bg-jade/10 px-2 py-0.5 text-[10.5px] font-semibold text-jade">{n} 人</span>
              <button
                type="button"
                className={btn}
                onClick={() => {
                  if (n && !window.confirm(`「${f.name || "这个势力"}」下还有 ${n} 位人物，删除后他们会变成无所属。确定删除？`)) return;
                  commit(value.filter((_, j) => j !== i));
                }}
                aria-label="删除势力"
              >
                ×
              </button>
            </div>
            <textarea className={`${inp} resize-y`} rows={2} value={f.desc ?? ""} placeholder="简介：这个势力是做什么的、立场如何（会写进对话提示词与世界书）" onChange={(e) => set(i, { desc: e.target.value || undefined })} aria-label="势力简介" />
            <div className={`grid grid-cols-1 gap-2 ${repOn ? "sm:grid-cols-[1fr_auto]" : ""}`}>
              <input
                className={inp}
                value={(f.tags ?? []).join("、")}
                placeholder="别称 / 关键词，用顿号分隔（对话里提到时会自动带出设定）"
                onChange={(e) => {
                  const tags = e.target.value.split(/[、,，]/).map((t) => t.trim()).filter(Boolean);
                  set(i, { tags: tags.length ? tags : undefined });
                }}
                aria-label="别称"
              />
              {repOn && <label className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-ink-soft">
                玩家加入时初始声望
                <input type="number" min={-100} max={100} className={`${inp} !w-20 text-center`} value={f.rep ?? 20} onChange={(e) => set(i, { rep: Math.max(-100, Math.min(100, Number(e.target.value) || 0)) })} />
              </label>}
            </div>
            <TerritoryPicker
              rooms={rooms}
              value={f.rooms ?? []}
              owner={(id) => value.find((x, j) => j !== i && x.rooms?.includes(id))?.name}
              onChange={(next) => set(i, { rooms: next.length ? next : undefined })}
            />
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={() => commit([...value, { id: uid(), name: "" }])}>＋ 新建势力</button>
        <span className="text-[11px] text-ink-soft">
          {repOn ? "已添加「阵营声望」：主角对每个势力有声望，建角可加入势力。" : "想让主角经营声望、加入势力、按声望调价？在「已添加的玩法」里加「阵营声望」。"}
        </span>
      </div>
    </div>
  );
}

/**
 * 功能注释：势力范围——勾选这个势力控制的地点。选上级地点即包含其下所有子地点（局内按地点层级判断）。
 * 局内作用：对话提示词说明「此地是谁的地盘」、事件条件「当前地点属于某势力范围」、开了阵营声望时地盘内购物按声望调价。
 */
function TerritoryPicker({ rooms, value, owner, onChange }: {
  rooms: { id: string; name: string; parent?: string }[];
  value: string[];
  owner: (roomId: string) => string | undefined;
  onChange: (next: string[]) => void;
}) {
  const ids = new Set(rooms.map((r) => r.id));
  const depth = (id: string) => { let d = 0; let p = rooms.find((r) => r.id === id)?.parent; while (p && ids.has(p) && d < 6) { d++; p = rooms.find((r) => r.id === p)?.parent; } return d; };
  // 功能注释：按树形顺序排（父在前、子缩进）
  const ordered: { id: string; name: string; d: number }[] = [];
  const walk = (parent: string | undefined) => {
    for (const r of rooms.filter((x) => (x.parent && ids.has(x.parent) ? x.parent : undefined) === parent)) {
      ordered.push({ id: r.id, name: r.name, d: depth(r.id) });
      walk(r.id);
    }
  };
  walk(undefined);
  const covered = (id: string) => { let p = rooms.find((r) => r.id === id)?.parent; while (p) { if (value.includes(p)) return true; p = rooms.find((r) => r.id === p)?.parent; } return false; };
  return (
    <div>
      <p className="mb-1 text-[11.5px] font-semibold text-ink">势力范围 <span className="font-normal text-ink-soft">· 可选；选上级地点即包含其下所有地点</span></p>
      {!ordered.length ? (
        <p className="text-[11px] text-ink-soft">作品还没有地点，先在下方「地点」里建。</p>
      ) : (
        <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto" role="group" aria-label="势力范围">
          {ordered.map((r) => {
            const on = value.includes(r.id);
            const inherited = !on && covered(r.id);
            const other = owner(r.id);
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                title={inherited ? "已由上级地点包含" : other ? `也属于「${other}」的势力范围` : undefined}
                onClick={() => onChange(on ? value.filter((x) => x !== r.id) : [...value, r.id])}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
                  on ? "border-jade/50 bg-jade/15 text-jade" : inherited ? "border-jade/25 bg-jade/5 text-jade/70" : "border-line bg-paper text-ink-soft hover:border-jade/40 hover:text-ink"
                }`}
              >
                {r.d ? `${"·".repeat(r.d)} ` : ""}{r.name}{other && !on ? " *" : ""}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
