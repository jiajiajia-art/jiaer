import type { StConfig, STRegexScript, STCharBookEntry } from './stRender';

type STCardV3 = {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  data?: any;
};

export function importFromSillyTavernCard(card: STCardV3): StConfig {
  const data = (card as any).data || {};
  const system = (data.system_prompt || '').trim();
  const personaName = data.name || card.name || '';
  const personaDesc = data.description || card.description || '';
  const first = data.first_mes || card.first_mes || '';

  const ex = (data.extensions || {}) as any;
  const rawRegex = ((ex.regex_scripts) || []) as STRegexScript[];
  const charBookEntries = ((ex.character_book && ex.character_book.entries) || []) as STCharBookEntry[];
  const description = String(data.description || card.description || '');

  const cfg: StConfig = {
    preset: system ? { system } : {},
    persona: { name: String(personaName), description: String(personaDesc), first_mes: String(first) },
    regex: [],
    variables: {},
    preferCharacterId: 'last',
    extensions: {
      regex_scripts: rawRegex,
      character_book: { entries: charBookEntries },
    },
    data: {
      description,
    },
  };
  return cfg;
}
