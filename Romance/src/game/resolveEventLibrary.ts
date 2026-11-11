import type { FixedEvent } from "../lib/types";
import type { LibraryGroup } from "./eventLibrary";

/**
 * 功能注释：模组编辑器的「事件库」只认本作品 events / eventGroups。
 * 缺省为空列表——新建作品不会带入娱乐圈 123 条预设（失约补救、人物链、职业库等）。
 * 游玩态请在调用方直接用 getWorldEvents / getWorldEventGroups，不要把当前世界塞进本函数。
 */
export function resolveModEventLibrary(
  libraryEvents?: FixedEvent[],
  libraryGroups?: LibraryGroup[],
): { events: FixedEvent[]; groups: LibraryGroup[] } {
  const groups = libraryGroups?.length
    ? libraryGroups
    : (libraryEvents?.length
      ? [{ id: "work_events", kind: "random" as const, title: "本作品事件", desc: "仅本作品内已有的事件", events: libraryEvents }]
      : []);
  const events = libraryEvents ?? groups.flatMap((g) => g.events);
  return { events, groups };
}
