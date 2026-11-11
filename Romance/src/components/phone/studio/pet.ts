/* 小珠桌宠的显示偏好：仅应用商店 / 常驻屏幕。另记录工坊是否打开（打开时隐藏桌宠，免得挡住工坊界面）。 */
import { loadGlobal, saveGlobal } from "../../../lib/saveScope";
import { useSyncExternalStore } from "react";

export type PetMode = "store" | "pinned";
const KEY = "star2005.phone.pet.mode";
const subs = new Set<() => void>();
let mode: PetMode = (() => { return loadGlobal<string>(KEY, "store") === "pinned" ? "pinned" : "store"; })();
let studioOpen = false;
const emit = () => subs.forEach((f) => f());
const sub = (f: () => void) => { subs.add(f); return () => subs.delete(f); };

export const usePetMode = () => useSyncExternalStore(sub, () => mode);
export const useStudioOpen = () => useSyncExternalStore(sub, () => studioOpen);
export function setPetMode(m: PetMode) { mode = m; saveGlobal(KEY, m); emit(); }
export function setStudioOpen(v: boolean) { if (studioOpen !== v) { studioOpen = v; emit(); } }
