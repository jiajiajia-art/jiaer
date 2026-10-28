import type { GameState } from "../lib/types";
import { PERSON_BY_ID, allRooms } from "../game/mud";
import { homeOptions, placeName } from "../game/homeSpot";

/* 常驻地点下拉：选项来自当前地图上已有的地点（含自建地点）；留空 = 不设定 */
export default function HomeSpotSelect({ game, pid, value, onChange, className }: { game: GameState; pid?: string; value: string; onChange: (v: string) => void; className?: string }) {
  const ids = homeOptions(game, value);
  const orphan = !!value && !allRooms().includes(value); // 选过的地点后来被删掉了：保留一项提示改选
  const fallback = pid && PERSON_BY_ID[pid]?.home ? "不设定 · 沿用原设定" : "不设定 · 不出现在地图上";
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="常驻地点" className={className}>
      <option value="">{fallback}</option>
      {ids.map((id) => <option key={id} value={id}>{placeName(game, id)}</option>)}
      {orphan && <option value={value}>（该地点已移除，请改选）</option>}
    </select>
  );
}
