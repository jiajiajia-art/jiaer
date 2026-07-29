import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import EditorApi from '../../api/galgame/EditorData';
import type { MorePromptForm } from '../../api/galgame/EditorData.type';
import {
  MORE_PROMPT_FORMS_MAX_COUNT,
  normalizeMorePromptForm,
  validateMorePromptFormsList,
} from '../../utils/morePromptForms';

interface UseMorePromptFormsOptions {
  fileId: string | null;
  /** 来自 gameData.worldSetting.morePromptForms */
  initialForms?: MorePromptForm[];
  onDataRefresh?: () => Promise<void>;
}

interface UseMorePromptFormsReturn {
  forms: MorePromptForm[];
  isSaving: boolean;
  canAddMore: boolean;
  saveForms: (nextForms: MorePromptForm[]) => Promise<boolean>;
  deleteForm: (id: string) => Promise<boolean>;
}

/**
 * Visual 侧栏 morePromptForms：读写 world.json（PUT /visual/edit/:fileId/world）
 */
export function useMorePromptForms({
  fileId,
  initialForms,
  onDataRefresh,
}: UseMorePromptFormsOptions): UseMorePromptFormsReturn {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);

  const forms = useMemo(
    () => (Array.isArray(initialForms) ? [...initialForms].sort((a, b) => a.order - b.order) : []),
    [initialForms],
  );

  const canAddMore = forms.length < MORE_PROMPT_FORMS_MAX_COUNT;

  const saveForms = useCallback(async (nextForms: MorePromptForm[]): Promise<boolean> => {
    if (!fileId) {
      toast.error(t('createGame.morePrompt.saveFailed'));
      return false;
    }

    const normalized = nextForms.map((form, index) => normalizeMorePromptForm(form, index));
    const validationKey = validateMorePromptFormsList(normalized);
    if (validationKey) {
      toast.error(t(validationKey));
      return false;
    }

    setIsSaving(true);
    try {
      const response = await EditorApi.updateWorldSetting(fileId, { morePromptForms: normalized });
      const payload = response.data as { success?: boolean; message?: string };
      if (!payload?.success) {
        throw new Error(payload?.message || 'save failed');
      }
      toast.success(t('createGame.morePrompt.saveSuccess'));
      if (onDataRefresh) {
        await onDataRefresh();
      }
      return true;
    } catch (error) {
      console.error('[useMorePromptForms] save failed:', error);
      toast.error(t('createGame.morePrompt.saveFailed'));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [fileId, onDataRefresh, t]);

  const deleteForm = useCallback(async (id: string): Promise<boolean> => {
    const nextForms = forms
      .filter((form) => form.id !== id)
      .map((form, index) => ({ ...form, order: index }));
    return saveForms(nextForms);
  }, [forms, saveForms]);

  return {
    forms,
    isSaving,
    canAddMore,
    saveForms,
    deleteForm,
  };
}
