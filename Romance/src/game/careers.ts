import type { GameState } from "../lib/types";
import { DIRECTIONS, PARENT_JOBS } from "./data";
import { PEOPLE } from "../worlds/star2005/content";
export function careersOf(game: GameState) {
  const entries = new Map<string, { id: string; name: string; description: string }>();
  const add = (name: string, source: string) => {
    name = name.trim(); if (!name) return;
    const id = `world_${encodeURIComponent(name)}`;
    const old = entries.get(id);
    if (!old) entries.set(id, { id, name, description: source });
    else if (!old.description.includes(source)) old.description += `；${source}`;
  };
  DIRECTIONS.forEach(d => add(d.name, "世界初始职业方向"));
  PARENT_JOBS.forEach(n => add(n, "世界家庭职业库"));
  PEOPLE.forEach(n => add(n.role, "世界固定人物职业"));
  game.sim.npcs.forEach(n => add(n.dir, "演艺圈职业"));
  game.npcs.forEach(n => add(n.identity, "当前存档人物职业"));
  (game.careerLibrary ?? []).forEach(c => entries.set(c.id, c));
  return [...entries.values()].filter(c => !game.hiddenCareerIds?.includes(c.id));
}
