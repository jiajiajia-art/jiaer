import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import EditorApi from '../../api/galgame/EditorData';
import type { DataPromptForm } from '../../api/galgame/EditorData.type';
import {
  DATA_PROMPT_FORMS_MAX_COUNT,
  normalizeDataPromptForm,
  validateDataPromptFormsList,
} from '../../utils/dataPromptForms';

interface UseDataPromptFormsOptions {
  fileId: string | null;
  /** 来自 gameData.worldSetting.dataPromptForms */
  initialForms?: DataPromptForm[];
  onDataRefresh?: () => Promise<void>;
}

interface UseDataPromptFormsReturn {
  forms: DataPromptForm[];
  isSaving: boolean;
  canAddMore: boolean;
  saveForms: (nextForms: DataPromptForm[]) => Promise<boolean>;
  deleteForm: (id: string) => Promise<boolean>;
}

/**
 * Visual Step6 dataPromptForms：读写 world.json（PUT /visual/edit/:fileId/world）
 */
export function useDataPromptForms({
  fileId,
  initialForms,
  onDataRefresh,
}: UseDataPromptFormsOptions): UseDataPromptFormsReturn {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);

  const forms = useMemo(
    () => (Array.isArray(initialForms) ? [...initialForms].sort((a, b) => a.order - b.order) : []),
    [initialForms],
  );

  const canAddMore = forms.length < DATA_PROMPT_FORMS_MAX_COUNT;

  const saveForms = useCallback(async (nextForms: DataPromptForm[]): Promise<boolean> => {
    if (!fileId) {
      toast.error(t('createGame.dataPrompt.saveFailed'));
      return false;
    }

    const normalized = nextForms.map((form, index) => normalizeDataPromptForm(form, index));
    const validationKey = validateDataPromptFormsList(normalized);
    if (validationKey) {
      toast.error(t(validationKey));
      return false;
    }

    setIsSaving(true);
    try {
      const response = await EditorApi.updateWorldSetting(fileId, { dataPromptForms: normalized });
      const payload = response.data as { success?: boolean; message?: string };
      if (!payload?.success) {
        throw new Error(payload?.message || 'save failed');
      }
      toast.success(t('createGame.dataPrompt.saveSuccess'));
      if (onDataRefresh) {
        await onDataRefresh();
      }
      return true;
    } catch (error) {
      console.error('[useDataPromptForms] save failed:', error);
      toast.error(t('createGame.dataPrompt.saveFailed'));
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
