import { STAT_LABELS, STAT_ORDER } from "../game/data";

export type PlayerAttributeField = { id: string; label: string; group: "primary" | "secondary"; enabled: boolean; max: number };

export const DEFAULT_PLAYER_ATTRIBUTES: PlayerAttributeField[] = [
  ...STAT_ORDER.map((id) => ({ id, label: STAT_LABELS[id], group: "primary" as const, enabled: true, max: 999 })),
  { id: "fame", label: "名气", group: "secondary", enabled: true, max: 999 },
  { id: "reputation", label: "口碑", group: "secondary", enabled: true, max: 100 },
  { id: "energy", label: "行动力", group: "secondary", enabled: true, max: 100 },
  { id: "stress", label: "压力", group: "secondary", enabled: true, max: 100 },
];
