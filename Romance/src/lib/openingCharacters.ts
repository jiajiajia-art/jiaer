/** 角色开局状态统一从人物自身开关读取；联系人必然也属于已认识。 */
export function resolveOpeningCharacterIds(
  people: readonly { id: string; metStart?: boolean; wxStart?: boolean }[],
  legacyStartMet: readonly string[] = [],
): { met: string[]; contacts: string[] } {
  const contacts = people.filter((person) => person.id && person.wxStart).map((person) => person.id);
  const met = [
    ...legacyStartMet,
    ...people.filter((person) => person.id && (person.metStart || person.wxStart)).map((person) => person.id),
  ];
  return { met: [...new Set(met)], contacts: [...new Set(contacts)] };
}
