/**
 * @deprecated 扣费依据已并入 ModEconomyRulesPanel（④ 剧情 → 结局）。
 * 保留空壳避免旧 import 路径瞬时崩掉；新代码请改用 ModEconomyRulesPanel。
 */
import ModEconomyRulesPanel from "./ModEconomyRulesPanel";
import type { Mod } from "../mods/types";

type C = Mod["content"];

export default function ModBalancePanel({
  c,
  kind: _kind,
  onChange,
}: {
  c: C;
  kind: Mod["kind"];
  onChange: (p: Partial<C>) => void;
}) {
  return <ModEconomyRulesPanel c={c} onChange={onChange} />;
}
