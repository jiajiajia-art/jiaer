/** 建角页不可删除、不可改类型、不可取消必填的四个系统字段。 */
export const SYSTEM_CREATION_FIELDS = [
  { key: "name", label: "姓名", type: "text" },
  { key: "gender", label: "性别", type: "radio" },
  { key: "age", label: "年龄", type: "number" },
  { key: "birthday", label: "生日", type: "date" },
] as const;

export type SystemCreationFieldKey = (typeof SYSTEM_CREATION_FIELDS)[number]["key"];

export const SYSTEM_CREATION_FIELD_KEYS: readonly SystemCreationFieldKey[] = SYSTEM_CREATION_FIELDS.map((f) => f.key);

/** 功能注释：旧版「内置」娱乐圈字段名；编辑器不再预置，仅用于清洗旧稿 builtin 槽 */
export const LEGACY_CREATION_FIELD_LABELS = [
  "出道身份",
  "人物描述",
  "气质设定",
  "出身阶层",
  "家世叙述",
  "父亲职业",
  "母亲职业",
  "玩家自填字段",
  "外形风格",
  "家庭背景",
  "职业方向",
  "星座",
] as const;

export function isSystemCreationFieldKey(key: string): key is SystemCreationFieldKey {
  return (SYSTEM_CREATION_FIELD_KEYS as readonly string[]).includes(key);
}

/** 性别始终保留男/女；创作者的自定义项清洗、去重后追加。 */
export function normalizeGenderOptions(options?: readonly string[]): string[] {
  const custom = (options ?? []).map((item) => String(item ?? "").trim()).filter((item) => item && item !== "男" && item !== "女");
  return ["男", "女", ...new Set(custom)];
}

type BuiltinCfg = { label?: string; hidden?: boolean; locked?: boolean; value?: string; options?: string[] };

/**
 * 功能注释：建角 builtin 只保留四个系统字段的显示名 / 性别选项；
 * 丢掉旧稿里的 identity/description/… 以及 hidden/locked（系统项不可藏、不可改非必填）。
 */
export function sanitizeCreationBuiltin(
  builtin?: Partial<Record<string, BuiltinCfg>> | null,
): Partial<Record<SystemCreationFieldKey, BuiltinCfg>> | undefined {
  if (!builtin || typeof builtin !== "object") return undefined;
  const out: Partial<Record<SystemCreationFieldKey, BuiltinCfg>> = {};
  for (const field of SYSTEM_CREATION_FIELDS) {
    const raw = builtin[field.key];
    if (!raw || typeof raw !== "object") continue;
    const next: BuiltinCfg = {};
    const label = String(raw.label ?? "").trim();
    if (label) next.label = label;
    if (field.key === "gender") {
      const options = normalizeGenderOptions(raw.options);
      // 功能注释：只有额外自定义性别时才写入 options，避免每个作品都冗余存 ["男","女"]
      if (options.length > 2) next.options = options;
    }
    if (Object.keys(next).length) out[field.key] = next;
  }
  return Object.keys(out).length ? out : undefined;
}
