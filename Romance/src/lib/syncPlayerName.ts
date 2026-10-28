/**
 * 建角改名同步：把人物描述等文案里的旧姓名换成新姓名（纯函数，无存档依赖）。
 */

/** 功能注释：模板重填或旧全名替换；锁定场景由调用方跳过本函数。 */
export function syncNameInDescription(
  prevName: string,
  nextName: string,
  description: string,
  seedTpl = "",
): string {
  if (!nextName || nextName === prevName) return description;
  const filledOld = seedTpl ? seedTpl.replace(/\{name\}/g, prevName) : "";
  if (seedTpl && (!description.trim() || description === filledOld || description === seedTpl)) {
    return seedTpl.replace(/\{name\}/g, nextName);
  }
  if (prevName && description.includes(prevName)) return description.split(prevName).join(nextName);
  return description;
}

/** 功能注释：改名时同步 description；descLocked 时只改 name。 */
export function syncPlayerNameChange<T extends { name: string; description?: string }>(
  prev: T,
  nextName: string,
  opts?: { descLocked?: boolean; seedDescription?: string },
): T {
  const name = (nextName ?? "").trim();
  if (!name || name === prev.name) return { ...prev, name: name || prev.name };
  const seedTpl = opts?.seedDescription ?? "";
  const description = opts?.descLocked
    ? (prev.description ?? "")
    : syncNameInDescription(prev.name, name, prev.description ?? "", seedTpl);
  return { ...prev, name, description };
}
