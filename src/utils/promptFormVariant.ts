import type { MorePromptForm } from '../api/galgame/EditorData.type';
import {
  MORE_PROMPT_DESCRIPTION_MAX_LENGTH,
  MORE_PROMPT_TITLE_MAX_LENGTH,
  buildMorePromptPanelId,
  createMorePromptFormId,
  isMorePromptPanel,
  MORE_PROMPT_NEW_PANEL,
  parseMorePromptPanel,
  validateMorePromptFormDraft,
} from './morePromptForms';
import {
  DATA_PROMPT_DESCRIPTION_MAX_LENGTH,
  DATA_PROMPT_TITLE_MAX_LENGTH,
  buildDataPromptPanelId,
  createDataPromptFormId,
  DATA_PROMPT_NEW_PANEL,
  parseDataPromptPanel,
  validateDataPromptFormDraft,
} from './dataPromptForms';

export type PromptFormVariant = 'morePrompt' | 'dataPrompt';

export interface PromptFormVariantConfig {
  i18nPrefix: 'createGame.morePrompt' | 'createGame.dataPrompt';
  descriptionMaxLength: number;
  titleMaxLength: number;
  newPanel: string;
  parsePanel: (panelId: string) => { kind: 'new' } | { kind: 'edit'; id: string } | null;
  buildPanelId: (id: string) => string;
  createFormId: () => string;
  validateDraft: (form: Partial<MorePromptForm>) => string | null;
}

const VARIANT_CONFIG: Record<PromptFormVariant, PromptFormVariantConfig> = {
  morePrompt: {
    i18nPrefix: 'createGame.morePrompt',
    descriptionMaxLength: MORE_PROMPT_DESCRIPTION_MAX_LENGTH,
    titleMaxLength: MORE_PROMPT_TITLE_MAX_LENGTH,
    newPanel: MORE_PROMPT_NEW_PANEL,
    parsePanel: parseMorePromptPanel,
    buildPanelId: buildMorePromptPanelId,
    createFormId: createMorePromptFormId,
    validateDraft: validateMorePromptFormDraft,
  },
  dataPrompt: {
    i18nPrefix: 'createGame.dataPrompt',
    descriptionMaxLength: DATA_PROMPT_DESCRIPTION_MAX_LENGTH,
    titleMaxLength: DATA_PROMPT_TITLE_MAX_LENGTH,
    newPanel: DATA_PROMPT_NEW_PANEL,
    parsePanel: parseDataPromptPanel,
    buildPanelId: buildDataPromptPanelId,
    createFormId: createDataPromptFormId,
    validateDraft: validateDataPromptFormDraft,
  },
};

export function getPromptFormVariantConfig(variant: PromptFormVariant): PromptFormVariantConfig {
  return VARIANT_CONFIG[variant];
}

export function isPromptFormPanel(panelId: string, variant: PromptFormVariant): boolean {
  return variant === 'morePrompt'
    ? isMorePromptPanel(panelId)
    : panelId === DATA_PROMPT_NEW_PANEL || panelId.startsWith('dataPrompt:');
}
