import { useState } from "react";
import type { Car } from "../game/data";
import type { TransportMode, TravelContent } from "../worlds/star2005/content";
import { complete, isConfigured } from "../lib/ai";
import { loadConfig } from "../lib/store";
import { IconSpark } from "../lib/icons";

/* 模组编辑器 · 车产系统：可售车辆（价格 / 残值 / 一次性购买增益 / 每次出行增益）+ 售卖地点；
 * 也可一键让 AI 按当前世界观的物价与时代感生成整套出行方式与车辆。 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
export const BONUS_EXTRA: Record<string, string> = { stress: "压力", mood: "心情", energy: "体力", money: "资金" };

export function BonusRow({ value, keys, onChange }: { value?: Record<string, number>; keys: Record<string, string>; onChange: (v?: Record<string, number>) => void }) {
  const list = Object.entries(value ?? {});
  const put = (l: [string, number][]) => onChange(l.length ? Object.fromEntries(l) : undefined);
  const first = Object.keys(keys).find((k) => !(k in (value ?? {})));
  return (
    <div className="flex flex-wrap items-center gap-1">
      {list.map(([k, v], i) => (
        <span key={k} className="flex items-center gap-0.5 rounded-full border border-line bg-paper px-1.5 py-0.5">
          <select className="bg-transparent text-[11.5px] text-ink outline-none" value={k} onChange={(e) => put(list.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))}>
            {Object.entries(keys).map(([kk, n]) => <option key={kk} value={kk}>{n}</option>)}
          </select>
          <input type="number" className="w-12 bg-transparent text-[11.5px] tabular-nums text-ink outline-none" value={v} onChange={(e) => put(list.map((x, j) => (j === i ? [x[0], Number(e.target.value) || 0] : x)))} />
          <button className="text-ink-soft hover:text-danger" onClick={() => put(list.filter((_, j) => j !== i))} aria-label="删除">×</button>
        </span>
      ))}
      {first && <button className="rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] text-ink-soft hover:border-jade hover:text-jade" onClick={() => put([...list, [first, 1]])}>＋ 增益</button>}
    </div>
  );
}

export default function ModCarsEditor({ cars, travel, rooms, statLabels, world, onChange }: {
  cars: Car[]; travel?: TravelContent; rooms: { id: string; name: string }[]; statLabels: Record<string, string>; world: string;
  onChange: (p: { cars?: Car[]; travel?: TravelContent }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const keys = { ...statLabels, ...BONUS_EXTRA };
  const t: TravelContent = { minutesPerHop: 20, feePerHop: 20, energyPerHop: 6, ...travel };
  const setCar = (i: number, p: Partial<Car>) => onChange({ cars: cars.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const ensureDrive = (tv: TravelContent): TravelContent => (tv.modes ?? []).some((m) => m.ownCar) ? tv : { ...tv, modes: [...(tv.modes ?? []), { id: "drive", label: "自己驾驶", fareMul: 0, timeMul: 1, fee: 0, note: "需要自有座驾", ownCar: true, icon: "drive" }] };

  const aiGen = async () => {
    const cfg = loadConfig();
    if (!isConfigured(cfg)) { setErr("尚未配置 AI，请先在菜单「AI 配置」里接入模型。"); return; }
    setBusy(true); setErr("");
    try {
      const raw = await complete(cfg, [
        { role: "system", content: "你是游戏数值策划。只输出 JSON，不要任何解释或代码块标记。" },
        { role: "user", content: `为下面这个世界观设计出行系统，物价、名称与交通感觉都要贴合该世界（古代就是马车轿子，修仙就是飞剑灵舟，现代就是地铁打车等）。\n世界观：${world}\n可用属性键：${Object.entries(keys).map(([k, n]) => `${k}=${n}`).join("，")}\n输出格式：{"modes":[{"id":"英文id","label":"名称","fee":每趟票价整数,"note":"一句说明","icon":"walk|bike|bus|subway|taxi|drive"}],"cars":[{"id":"英文id","name":"名称","price":售价整数,"resale":0到1残值率,"tag":"两字标签","desc":"一句描述","buyBonus":{"属性键":数值},"tripBonus":{"属性键":数值}}]}\n要求：modes 3~5 种公共/租用出行方式（含一种免费的）；cars 3~5 款可购买的私人交通工具，价格从入门到顶级；buyBonus 为购买时一次性增益，tripBonus 为每次自己驾驶出行的增益（压力用负数表示减压），数值克制。` },
      ]);
      const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as { modes?: TransportMode[]; cars?: Car[] };
      const modes = (j.modes ?? []).filter((m) => m?.label).map((m, i) => ({ id: m.id || `m${i}`, label: m.label, fee: Math.max(0, Math.round(Number(m.fee) || 0)), note: m.note ?? "", icon: m.icon ?? "walk", fareMul: 0, timeMul: 1 }));
      const nc = (j.cars ?? []).filter((c) => c?.name && Number(c.price) > 0).map((c, i) => ({ id: c.id || `car${i}`, name: c.name, price: Math.round(Number(c.price)), resale: Math.min(0.95, Math.max(0.05, Number(c.resale) || 0.5)), comfort: 0, tag: c.tag ?? "", desc: c.desc ?? "", buyBonus: c.buyBonus, tripBonus: c.tripBonus }));
      if (!modes.length && !nc.length) throw new Error("AI 没有返回可用的方案，请重试。");
      onChange({ cars: nc.length ? nc : cars, travel: ensureDrive({ ...t, modes: modes.length ? modes : t.modes }) });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "生成失败，请稍后再试。");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-jade/10 to-coral/10 px-3 py-2">
        <p className="text-[11.5px] leading-snug text-ink-soft">不想手动配？让 AI 按这个世界的物价与时代感，生成出行方式和可购买的交通工具。</p>
        <button className={`${btn} shrink-0 !border-transparent bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] !text-white`} disabled={busy} onClick={aiGen}>{busy ? "生成中…" : "AI 生成"}</button>
      </div>
      {err && <p className="text-[11px] text-danger">{err}</p>}

      <label className="block text-[11px] text-ink-soft">售卖地点（玩家在这里购买交通工具，必选）
        <select className={`${inp} mt-0.5 ${t.carShop ? "" : "!border-danger"}`} value={t.carShop ?? ""} onChange={(e) => onChange({ travel: ensureDrive({ ...t, carShop: e.target.value || undefined }) })}>
          <option value="">请选择地点</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}
        </select>
      </label>

      {cars.map((c, i) => (
        <div key={i} className="space-y-1.5 rounded-xl border border-line bg-paper-2 p-2">
          <div className="flex gap-1.5">
            <input className={`${inp} ${String(c.name ?? "").trim() ? "" : "!border-danger"}`} value={String(c.name ?? "")} placeholder="名称（如：枣红马 / 飞剑 / 轿车）" onChange={(e) => setCar(i, { name: e.target.value })} />
            <input className={`${inp} !w-16 shrink-0`} value={String(c.tag ?? "")} placeholder="标签" onChange={(e) => setCar(i, { tag: e.target.value })} />
            <button className={`${btn} shrink-0`} onClick={() => onChange({ cars: cars.filter((_, j) => j !== i) })} aria-label="删除">×</button>
          </div>
          <input className={inp} value={String(c.desc ?? "")} placeholder="一句描述" onChange={(e) => setCar(i, { desc: e.target.value })} />
          <div className="grid grid-cols-2 gap-1.5">
            <label className="text-[11px] text-ink-soft">售价<input type="number" min={0} className={`${inp} mt-0.5`} value={c.price} onChange={(e) => setCar(i, { price: Math.max(0, Number(e.target.value) || 0) })} /></label>
            <label className="text-[11px] text-ink-soft">转卖回收（%）<input type="number" min={0} max={100} className={`${inp} mt-0.5`} value={Math.round(c.resale * 100)} onChange={(e) => setCar(i, { resale: Math.min(1, Math.max(0, (Number(e.target.value) || 0) / 100)) })} /></label>
          </div>
          <div className="text-[11px] text-ink-soft">购买时一次性增益<BonusRow value={c.buyBonus} keys={keys} onChange={(v) => setCar(i, { buyBonus: v })} /></div>
          <div className="text-[11px] text-ink-soft">每次驾驶出行增益<BonusRow value={c.tripBonus} keys={keys} onChange={(v) => setCar(i, { tripBonus: v })} /></div>
        </div>
      ))}
      <button className={btn} onClick={() => { onChange({ cars: [...cars, { id: `car${Date.now().toString(36).slice(-4)}`, name: "", price: 10000, resale: 0.5, comfort: 0, tag: "", desc: "" }], travel: ensureDrive(t) }); }}>＋ 添加交通工具</button>
    </div>
  );
}
