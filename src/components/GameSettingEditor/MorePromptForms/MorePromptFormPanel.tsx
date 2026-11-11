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
import { FiInfo } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import styles from './MorePromptFormPanel.module.css';
import MarkdownContentField from './MarkdownContentField';
import type { MorePromptForm } from '../../../api/galgame/EditorData.type';
import {
  countUnicodeChars,
} from '../../../utils/morePromptForms';
import {
  getPromptFormVariantConfig,
  type PromptFormVariant,
} from '../../../utils/promptFormVariant';
import { useUnsavedChanges } from '../../../hooks/editor/useUnsavedChanges';

export interface MorePromptFormPanelRef {
  checkBeforeLeave: (action?: () => void) => boolean;
}

interface MorePromptFormPanelProps {
  variant?: PromptFormVariant;
  activePanel: string;
  forms: MorePromptForm[];
  isSaving?: boolean;
  onSave: (form: MorePromptForm, allForms: MorePromptForm[]) => Promise<boolean>;
  onCancel: () => void;
}

const buildEmptyDraft = (variant: PromptFormVariant, order: number): MorePromptForm => {
  const config = getPromptFormVariantConfig(variant);
  return {
    id: config.createFormId(),
    title: '',
    description: '',
    content: '',
    constant: false,
    enabled: true,
    order,
  };
};

/**
 * Visual 动态提示词右侧表单（标题 / Markdown 内容 / 描述）
 */
const MorePromptFormPanel = forwardRef<MorePromptFormPanelRef, MorePromptFormPanelProps>(
  function MorePromptFormPanel({
    variant = 'morePrompt',
    activePanel,
    forms,
    isSaving = false,
    onSave,
    onCancel,
  }, ref) {
  const { t } = useTranslation();
  const config = getPromptFormVariantConfig(variant);
  const i18n = (key: string, options?: Record<string, unknown>) => t(`${config.i18nPrefix}.${key}`, options);
  const parsed = config.parsePanel(activePanel);
  const panelKind = parsed?.kind ?? null;
  const panelEditId = parsed?.kind === 'edit' ? parsed.id : null;
  const initialDraftRef = useRef<string>('');

  const [draft, setDraft] = useState<MorePromptForm>(() => buildEmptyDraft(variant, forms.length));

  const existingForm = useMemo(
    () => (panelEditId ? forms.find((item) => item.id === panelEditId) ?? null : null),
    [forms, panelEditId],
  );

  // 仅在切换 panel / 编辑目标变化时重置草稿，避免 parsed 对象引用导致无限 setState
  useEffect(() => {
    if (panelKind === 'new') {
      const next = buildEmptyDraft(variant, forms.length);
      setDraft(next);
      initialDraftRef.current = JSON.stringify(next);
      return;
    }
    if (panelKind === 'edit' && existingForm) {
      setDraft({ ...existingForm });
      initialDraftRef.current = JSON.stringify(existingForm);
    }
  }, [activePanel, panelKind, panelEditId, existingForm, forms.length, variant]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== initialDraftRef.current,
    [draft],
  );

  const descRemaining = config.descriptionMaxLength - countUnicodeChars(draft.description);

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
    const validationKey = config.validateDraft(draft);
    if (validationKey) {
      toast.error(t(validationKey));
      return false;
    }

    const normalized: MorePromptForm = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      content: draft.content.trim(),
      constant: draft.constant === true,
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
  }, [config, draft, forms, onSave, parsed, t]);

  handleConfirmRef.current = handleConfirm;

  if (!parsed) {
    return null;
  }

  return (
    <>
      <div className={styles.panel}>
      {parsed.kind === 'edit' && (
        <header className={styles.header}>
          <h2>{i18n('edit')}</h2>
        </header>
      )}

      <div className={styles.form}>
        <label className={styles.field}>
          <div className={styles.fieldLabelRow}>
            <span>
              {i18n('title')}
              {!draft.constant && <span className={styles.required}>*</span>}
            </span>
            <div className={styles.tipWrap}>
              <button
                type="button"
                className={styles.tipBtn}
                aria-label={i18n('titleTipLabel')}
                disabled={isSaving}
              >
                <FiInfo aria-hidden />
              </button>
              <div className={styles.tipBubble} role="tooltip">
                {i18n('titleHint')}
              </div>
            </div>
          </div>
          <input
            type="text"
            value={draft.title}
            maxLength={config.titleMaxLength}
            placeholder={i18n('titlePlaceholder')}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            disabled={isSaving}
          />
        </label>

        <div className={styles.constantRow}>
          <label className={styles.fieldCheckbox}>
            <input
              type="checkbox"
              checked={draft.constant === true}
              onChange={(event) => setDraft((prev) => ({ ...prev, constant: event.target.checked }))}
              disabled={isSaving}
            />
            <span>{i18n('constantLabel')}</span>
          </label>
          <div className={styles.tipWrap}>
            <button
              type="button"
              className={styles.tipBtn}
              aria-label={i18n('selectiveTipLabel')}
              disabled={isSaving}
            >
              <FiInfo aria-hidden />
            </button>
            <div className={styles.tipBubble} role="tooltip">
              {i18n('selectiveHint')}
            </div>
          </div>
        </div>

        <label className={styles.field}>
          <div className={styles.fieldLabelRow}>
            <span>
              {i18n('content')}
              <span className={styles.required}>*</span>
            </span>
            <div className={styles.tipWrap}>
              <button
                type="button"
                className={styles.tipBtn}
                aria-label={i18n('contentTipLabel')}
                disabled={isSaving}
              >
                <FiInfo aria-hidden />
              </button>
              <div className={styles.tipBubble} role="tooltip">
                {i18n('contentHint')}
              </div>
            </div>
          </div>
          <MarkdownContentField
            value={draft.content}
            onChange={(content) => setDraft((prev) => ({ ...prev, content }))}
            disabled={isSaving}
          />
        </label>

        <label className={styles.field}>
          <div className={styles.fieldLabelRow}>
            <span>
              {i18n('description')}
              <span className={styles.required}>*</span>
            </span>
            <div className={styles.tipWrap}>
              <button
                type="button"
                className={styles.tipBtn}
                aria-label={i18n('descriptionTipLabel')}
                disabled={isSaving}
              >
                <FiInfo aria-hidden />
              </button>
              <div className={styles.tipBubble} role="tooltip">
                {i18n('descriptionHint')}
              </div>
            </div>
          </div>
          <input
            type="text"
            value={draft.description}
            onChange={(event) => {
              const next = event.target.value;
              if (countUnicodeChars(next) <= config.descriptionMaxLength) {
                setDraft((prev) => ({ ...prev, description: next }));
              }
            }}
            disabled={isSaving}
          />
          <small className={descRemaining < 0 ? styles.descOver : styles.descHint}>
            {i18n('descRemaining', { count: Math.max(0, descRemaining) })}
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
          {i18n('confirm')}
        </button>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={() => checkBeforeAction(onCancel)}
          disabled={isSaving}
        >
          {i18n('cancel')}
        </button>
      </div>
      </div>
      {SaveConfirmModalComponent}
    </>
  );
});

MorePromptFormPanel.displayName = 'MorePromptFormPanel';

export default MorePromptFormPanel;