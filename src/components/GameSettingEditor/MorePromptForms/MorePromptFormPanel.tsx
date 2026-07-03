import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import styles from './MorePromptFormPanel.module.css';
import MarkdownContentField from './MarkdownContentField';
import type { MorePromptForm } from '../../../api/galgame/EditorData.type';
import {
  MORE_PROMPT_DESCRIPTION_MAX_LENGTH,
  MORE_PROMPT_TITLE_MAX_LENGTH,
  countUnicodeChars,
  validateMorePromptFormDraft,
  parseMorePromptPanel,
  createMorePromptFormId,
} from '../../../utils/morePromptForms';
import { useUnsavedChanges } from '../../../hooks/editor/useUnsavedChanges';

export interface MorePromptFormPanelRef {
  checkBeforeLeave: (action?: () => void) => boolean;
}

interface MorePromptFormPanelProps {
  activePanel: string;
  forms: MorePromptForm[];
  isSaving?: boolean;
  onSave: (form: MorePromptForm, allForms: MorePromptForm[]) => Promise<boolean>;
  onCancel: () => void;
}

const emptyDraft = (): Omit<MorePromptForm, 'order'> & { order?: number } => ({
  id: createMorePromptFormId(),
  title: '',
  description: '',
  content: '',
  enabled: true,
});

/**
 * Visual 动态提示词右侧表单（标题 / Markdown 内容 / 描述）
 */
const MorePromptFormPanel = forwardRef<MorePromptFormPanelRef, MorePromptFormPanelProps>(
  function MorePromptFormPanel({
    activePanel,
    forms,
    isSaving = false,
    onSave,
    onCancel,
  }, ref) {
  const { t } = useTranslation();
  const parsed = parseMorePromptPanel(activePanel);
  const panelKind = parsed?.kind ?? null;
  const panelEditId = parsed?.kind === 'edit' ? parsed.id : null;
  const initialDraftRef = useRef<string>('');

  const [draft, setDraft] = useState<MorePromptForm>(() => ({
    ...emptyDraft(),
    order: forms.length,
  }));

  const existingForm = useMemo(
    () => (panelEditId ? forms.find((item) => item.id === panelEditId) ?? null : null),
    [forms, panelEditId],
  );

  // 仅在切换 panel / 编辑目标变化时重置草稿，避免 parsed 对象引用导致无限 setState
  useEffect(() => {
    if (panelKind === 'new') {
      const next = { ...emptyDraft(), order: forms.length };
      setDraft(next);
      initialDraftRef.current = JSON.stringify(next);
      return;
    }
    if (panelKind === 'edit' && existingForm) {
      setDraft({ ...existingForm });
      initialDraftRef.current = JSON.stringify(existingForm);
    }
  }, [activePanel, panelKind, panelEditId, existingForm, forms.length]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== initialDraftRef.current,
    [draft],
  );

  const descRemaining = MORE_PROMPT_DESCRIPTION_MAX_LENGTH - countUnicodeChars(draft.description);

  const handleConfirmRef = useRef<(() => Promise<boolean>) | null>(null);

  const {
    setHasUnsavedChanges,
    SaveConfirmModalComponent,
    getCheckBeforeLeave,
    checkBeforeAction,
  } = useUnsavedChanges({
    onSave: async () => {
      if (handleConfirmRef.current) {
        return await handleConfirmRef.current();
      }
      return false;
    },
  });

  useEffect(() => {
    setHasUnsavedChanges(isDirty);
  }, [isDirty, setHasUnsavedChanges]);

  useImperativeHandle(ref, () => ({
    checkBeforeLeave: getCheckBeforeLeave(),
  }), [getCheckBeforeLeave]);

  const handleConfirm = useCallback(async (): Promise<boolean> => {
    const validationKey = validateMorePromptFormDraft(draft);
    if (validationKey) {
      toast.error(t(validationKey));
      return false;
    }

    const normalized: MorePromptForm = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      content: draft.content.trim(),
      updatedAt: new Date().toISOString(),
    };

    let nextForms: MorePromptForm[];
    if (parsed?.kind === 'new') {
      nextForms = [...forms, { ...normalized, order: forms.length }];
    } else {
      nextForms = forms.map((item) => (item.id === normalized.id ? normalized : item));
    }
    nextForms = nextForms.map((item, index) => ({ ...item, order: index }));

    const ok = await onSave(normalized, nextForms);
    if (ok) {
      initialDraftRef.current = JSON.stringify(normalized);
    }
    return ok;
  }, [draft, forms, onSave, parsed, t]);

  handleConfirmRef.current = handleConfirm;

  if (!parsed) {
    return null;
  }

  return (
    <>
      <div className={styles.panel}>
      <header className={styles.header}>
        {parsed.kind === 'edit' && (
          <h2>{t('createGame.morePrompt.edit')}</h2>
        )}
        <p className={styles.subtitle}>{t('createGame.morePrompt.sectionSubtitle')}</p>
      </header>

      <div className={styles.form}>
        <label className={styles.field}>
          <span>{t('createGame.morePrompt.title')}</span>
          <input
            type="text"
            value={draft.title}
            maxLength={MORE_PROMPT_TITLE_MAX_LENGTH}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            disabled={isSaving}
          />
        </label>

        <label className={styles.field}>
          <span>{t('createGame.morePrompt.content')}</span>
          <MarkdownContentField
            value={draft.content}
            onChange={(content) => setDraft((prev) => ({ ...prev, content }))}
            disabled={isSaving}
          />
        </label>

        <label className={styles.field}>
          <span>{t('createGame.morePrompt.description')}</span>
          <input
            type="text"
            value={draft.description}
            onChange={(event) => {
              const next = event.target.value;
              if (countUnicodeChars(next) <= MORE_PROMPT_DESCRIPTION_MAX_LENGTH) {
                setDraft((prev) => ({ ...prev, description: next }));
              }
            }}
            disabled={isSaving}
          />
          <small className={descRemaining < 0 ? styles.descOver : styles.descHint}>
            {t('createGame.morePrompt.descRemaining', { count: Math.max(0, descRemaining) })}
          </small>
        </label>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.confirmBtn}
          onClick={() => { void handleConfirm(); }}
          disabled={isSaving}
        >
          {t('createGame.morePrompt.confirm')}
        </button>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={() => checkBeforeAction(onCancel)}
          disabled={isSaving}
        >
          {t('createGame.morePrompt.cancel')}
        </button>
      </div>
      </div>
      {SaveConfirmModalComponent}
    </>
  );
});

MorePromptFormPanel.displayName = 'MorePromptFormPanel';

export default MorePromptFormPanel;