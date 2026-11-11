/**
 * 玩法依赖摘要：playModInstalls.dependsOn 与 Mod.dependencies 不是同一数据。
 * 本模块只描述「玩法组件之间」的依赖，供编辑器玩法页展示。
 */
import {
  catalogBySlug,
  type PlayModInstallConfig,
} from "../mods/playModCatalog.ts";

export type PlayModDepEdge = {
  slug: string;
  name: string;
  needs: { slug: string; name: string; installed: boolean }[];
};

/** 功能注释：列出已安装玩法对外声明的依赖及是否已装，供玩法页摘要 */
export function summarizePlayModDeps(installs: PlayModInstallConfig[] | undefined): PlayModDepEdge[] {
  const list = installs ?? [];
  const have = new Set(list.flatMap((x) => [x.slug, x.modId]));
  const out: PlayModDepEdge[] = [];
  for (const inst of list) {
    const cat = catalogBySlug(inst.slug);
    const deps = inst.dependsOn ?? cat?.dependsOn ?? [];
    if (!deps.length) continue;
    out.push({
      slug: inst.slug,
      name: cat?.name || inst.slug,
      needs: deps.map((d) => {
        const dep = catalogBySlug(d);
        return {
          slug: d,
          name: dep?.name || d,
          installed: have.has(d),
        };
      }),
    });
  }
  return out;
}

/**
 * 功能注释：移除某玩法时，找出「仍被其它已装玩法需要」的共享依赖 slug，禁止静默删。
 */
export function playModsDependingOn(
  targetSlug: string,
  installs: PlayModInstallConfig[] | undefined,
): { slug: string; name: string }[] {
  const list = installs ?? [];
  const blockers: { slug: string; name: string }[] = [];
  for (const inst of list) {
    if (inst.slug === targetSlug) continue;
    const cat = catalogBySlug(inst.slug);
    const deps = inst.dependsOn ?? cat?.dependsOn ?? [];
    if (deps.includes(targetSlug) || deps.includes(catalogBySlug(targetSlug)?.id || "")) {
      blockers.push({ slug: inst.slug, name: cat?.name || inst.slug });
    }
  }
  return blockers;
}

/**
 * 功能注释：主玩法移除后，找出仍标为 autoInstalled、且已无人依赖的条目，供确认后一并卸掉。
 * 无 autoInstalled 标记的视为手动配置，不进入候选。
 */
export function orphanedAutoPlayDeps(
  remaining: PlayModInstallConfig[] | undefined,
): PlayModInstallConfig[] {
  const list = remaining ?? [];
  return list.filter((inst) => {
    if (!inst.autoInstalled) return false;
    return playModsDependingOn(inst.slug, list).length === 0;
  });
}
