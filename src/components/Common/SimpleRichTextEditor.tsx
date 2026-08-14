import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { HOST_ADDRESS } from '../../config';
import { getImageUrl } from '../../utils/constants';
import {
  NOVEL_DESCRIPTION_MAX_LENGTH,
  descriptionToPlainText,
  hydrateDescriptionHtmlForDisplay,
  normalizeDescriptionHtmlForSave,
  toEditorHtml,
} from '../../utils/gameDescriptionHtml';
import {
  RICH_EDITOR_DEFAULT_HEIGHT_PX,
  clampRichEditorHeight,
} from '../../utils/richEditorResize.ts';
import {
  insertRichEditorLineBreak,
  shouldInsertLineBreakOnKeyDown,
} from '../../utils/richEditorEnter.ts';
import {
  applyRichEditorSourceHtml,
  openRichEditorSourceDraft,
} from '../../utils/richEditorSource.ts';
import { shouldForceRestoreVisualAfterSourceExit } from '../../utils/richEditorSourceRestore.ts';
import styles from './SimpleRichTextEditor.module.css';

export type SimpleRichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxPlainLength?: number;
  className?: string;
  /** 上传图片并返回可公开访问的 URL（如 /public/...） */
  onUploadImage?: (file: File) => Promise<string>;
  /** 图片插入编辑器并同步 onChange 之后回调（用于自动落库简介） */
  onAfterImageInsert?: (html: string) => void;
  showToolbar?: boolean;
};

function exec(command: string, value?: string) {
  try {
    document.execCommand(command, false, value);
  } catch {
    // ignore unsupported commands
  }
}

const SimpleRichTextEditor: React.FC<SimpleRichTextEditorProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder,
  maxPlainLength = NOVEL_DESCRIPTION_MAX_LENGTH,
  className,
  onUploadImage,
  onAfterImageInsert,
  showToolbar = true,
}) => {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastEmittedRef = useRef<string>('');
  const savedRangeRef = useRef<Range | null>(null);
  const resizeStartRef = useRef<{ y: number; height: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editorHeight, setEditorHeight] = useState(RICH_EDITOR_DEFAULT_HEIGHT_PX);
  const [resizing, setResizing] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceDraft, setSourceDraft] = useState('');
  const plainLength = Array.from(
    descriptionToPlainText(sourceMode ? sourceDraft : value),
  ).length;

  const readEditorHtmlForSave = (): string => {
    const el = editorRef.current;
    if (!el) return '';
    return normalizeDescriptionHtmlForSave(el.innerHTML, HOST_ADDRESS);
  };

  const writeEditorHtmlFromValue = (raw: string) => {
    const el = editorRef.current;
    if (!el) return;
    const stored = toEditorHtml(raw);
    const display = hydrateDescriptionHtmlForDisplay(stored, getImageUrl);
    el.innerHTML = display;
    lastEmittedRef.current = stored;
  };

  useEffect(() => {
    if (sourceMode) return;
    const el = editorRef.current;
    if (!el) return;
    const nextStored = toEditorHtml(value);
    const forceRestore = shouldForceRestoreVisualAfterSourceExit({
      sourceMode: false,
      valueHtml: nextStored,
      lastEmittedHtml: lastEmittedRef.current,
      visualInnerHTML: el.innerHTML,
    });
    if (!forceRestore && nextStored === lastEmittedRef.current) return;
    writeEditorHtmlFromValue(nextStored || value);
  }, [value, sourceMode]);

  useEffect(() => {
    if (!resizing) return;

    const onMove = (event: PointerEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const next = clampRichEditorHeight(start.height + (event.clientY - start.y), {
        viewportHeight: window.innerHeight,
      });
      setEditorHeight(next);
    };

    const onUp = () => {
      resizeStartRef.current = null;
      setResizing(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [resizing]);

  const beginResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const current = editorRef.current?.getBoundingClientRect().height || editorHeight;
    resizeStartRef.current = { y: event.clientY, height: current };
    setResizing(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const saveSelection = () => {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const restoreSelection = (): boolean => {
    const el = editorRef.current;
    const range = savedRangeRef.current;
    if (!el || !range) return false;
    try {
      el.focus();
      const sel = window.getSelection();
      if (!sel) return false;
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch {
      return false;
    }
  };

  const emitChange = () => {
    const html = readEditorHtmlForSave();
    lastEmittedRef.current = html;
    onChange(html);
  };

  const handleInput = () => {
    saveSelection();
    emitChange();
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    if (html) {
      exec('insertHTML', hydrateDescriptionHtmlForDisplay(html, getImageUrl));
    } else {
      exec('insertText', text);
    }
    emitChange();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (!shouldInsertLineBreakOnKeyDown(event)) return;
    event.preventDefault();
    insertRichEditorLineBreak();
    saveSelection();
    emitChange();
  };

  const openSourceMode = () => {
    if (disabled) return;
    const current = readEditorHtmlForSave() || openRichEditorSourceDraft(value, HOST_ADDRESS);
    setSourceDraft(current);
    setSourceMode(true);
  };

  const cancelSourceMode = () => {
    setSourceMode(false);
    setSourceDraft('');
    // 源码模式会卸载可视化 DOM，取消后必须按当前 value 强制回写
    requestAnimationFrame(() => {
      writeEditorHtmlFromValue(value);
    });
  };

  const saveSourceMode = () => {
    const { html, plainLength: nextPlain } = applyRichEditorSourceHtml(sourceDraft, HOST_ADDRESS);
    if (nextPlain > maxPlainLength) {
      toast.error(
        t('common.richEditor.sourceTooLong', {
          defaultValue: '简介纯文本不能超过 {{max}} 字',
          max: maxPlainLength,
        }),
      );
      return;
    }
    lastEmittedRef.current = html;
    onChange(html);
    setSourceMode(false);
    setSourceDraft('');
    // 下一帧写回可视化，避免 sourceMode 尚未退出时被跳过
    requestAnimationFrame(() => {
      writeEditorHtmlFromValue(html);
    });
    toast.success(t('common.richEditor.sourceSaved', { defaultValue: '源码已保存' }));
  };

  const insertImageAtCursor = (uploadedUrl: string) => {
    const el = editorRef.current;
    if (!el) return;

    const rawUrl = String(uploadedUrl || '').trim();
    if (!rawUrl) return;
    const storedSrc = rawUrl.startsWith('http') || rawUrl.startsWith('/')
      ? rawUrl
      : `/${rawUrl}`;
    const displaySrc = getImageUrl(storedSrc) || storedSrc;

    el.focus();
    restoreSelection();

    const img = document.createElement('img');
    img.setAttribute('src', displaySrc);
    img.setAttribute('alt', '');

    const sel = window.getSelection();
    const canInsertAtCaret = !!(
      sel
      && sel.rangeCount > 0
      && el.contains(sel.anchorNode)
    );

    if (canInsertAtCaret && sel) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);
      const after = document.createTextNode('\u200B');
      if (img.parentNode) {
        img.parentNode.insertBefore(after, img.nextSibling);
      }
      range.setStartAfter(after);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      savedRangeRef.current = range.cloneRange();
    } else {
      const p = document.createElement('p');
      p.appendChild(img);
      el.appendChild(p);
      const range = document.createRange();
      range.setStartAfter(img);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      savedRangeRef.current = range.cloneRange();
    }

    emitChange();
    const savedHtml = readEditorHtmlForSave();
    onAfterImageInsert?.(savedHtml);
  };

  const handlePickImage = async (file: File | null) => {
    if (!file || disabled || sourceMode) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('common.richEditor.imageTypeInvalid', { defaultValue: '请选择图片文件' }));
      return;
    }
    if (!onUploadImage) {
      toast.error(t('common.richEditor.imageUploadUnavailable', { defaultValue: '当前无法上传图片' }));
      return;
    }
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      insertImageAtCursor(url);
    } catch (err: unknown) {
      const axiosMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const message = axiosMsg
        || (err instanceof Error ? err.message : String(err || ''));
      toast.error(message || t('common.richEditor.imageUploadFailed', { defaultValue: '图片上传失败' }));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatDisabled = disabled || sourceMode;

  return (
    <div className={`${styles.root} ${className || ''} ${disabled ? styles.disabled : ''}`}>
      {showToolbar ? (
        <div className={styles.toolbar} role="toolbar">
          <button type="button" className={styles.toolBtn} disabled={formatDisabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); exec('bold'); emitChange(); }} title="Bold">
            B
          </button>
          <button type="button" className={styles.toolBtn} disabled={formatDisabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); exec('italic'); emitChange(); }} title="Italic">
            I
          </button>
          <button type="button" className={styles.toolBtn} disabled={formatDisabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); exec('underline'); emitChange(); }} title="Underline">
            U
          </button>
          <button type="button" className={styles.toolBtn} disabled={formatDisabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); exec('insertUnorderedList'); emitChange(); }} title="List">
            •
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            disabled={formatDisabled || uploading || !onUploadImage}
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
              fileInputRef.current?.click();
            }}
            title={t('common.richEditor.insertImage', { defaultValue: '插入图片' })}
          >
            {uploading
              ? t('common.richEditor.uploading', { defaultValue: '上传中…' })
              : t('common.richEditor.insertImage', { defaultValue: '图片' })}
          </button>
          {!sourceMode ? (
            <button
              type="button"
              className={styles.toolBtn}
              disabled={disabled}
              onMouseDown={(e) => {
                e.preventDefault();
                openSourceMode();
              }}
              title={t('common.richEditor.viewSource', { defaultValue: '查看源码' })}
            >
              {t('common.richEditor.viewSource', { defaultValue: '源码' })}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`${styles.toolBtn} ${styles.toolBtnPrimary}`}
                disabled={disabled}
                onMouseDown={(e) => {
                  e.preventDefault();
                  saveSourceMode();
                }}
                title={t('common.richEditor.saveSource', { defaultValue: '保存源码' })}
              >
                {t('common.richEditor.saveSource', { defaultValue: '保存' })}
              </button>
              <button
                type="button"
                className={styles.toolBtn}
                disabled={disabled}
                onMouseDown={(e) => {
                  e.preventDefault();
                  cancelSourceMode();
                }}
                title={t('common.richEditor.cancelSource', { defaultValue: '取消源码编辑' })}
              >
                {t('common.richEditor.cancelSource', { defaultValue: '取消' })}
              </button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void handlePickImage(e.target.files?.[0] || null)}
          />
        </div>
      ) : null}
      <div className={`${styles.editorWrap}${resizing ? ` ${styles.editorWrapResizing}` : ''}`}>
        {!sourceMode && !descriptionToPlainText(value) && !/<img\b/i.test(value) ? (
          <div className={styles.placeholder} aria-hidden>
            {placeholder || ''}
          </div>
        ) : null}
        <div
          ref={editorRef}
          className={styles.editor}
          style={{ height: editorHeight, display: sourceMode ? 'none' : undefined }}
          contentEditable={!disabled && !sourceMode}
          role="textbox"
          aria-multiline="true"
          aria-hidden={sourceMode}
          data-placeholder={placeholder || ''}
          onInput={handleInput}
          onBlur={() => {
            if (sourceMode) return;
            saveSelection();
            emitChange();
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onPaste={handlePaste}
          suppressContentEditableWarning
        />
        {sourceMode ? (
          <textarea
            className={`${styles.editor} ${styles.sourceEditor}`}
            style={{ height: editorHeight }}
            value={sourceDraft}
            onChange={(e) => setSourceDraft(e.target.value)}
            disabled={disabled}
            spellCheck={false}
            aria-label={t('common.richEditor.viewSource', { defaultValue: '查看源码' })}
            placeholder="<p>...</p>"
          />
        ) : null}
        <button
          type="button"
          className={styles.resizeHandle}
          aria-label={t('common.richEditor.resize', { defaultValue: '拖拽调整高度' })}
          title={t('common.richEditor.resize', { defaultValue: '拖拽调整高度' })}
          disabled={disabled}
          onPointerDown={beginResize}
        />
      </div>
      <div className={styles.metaRow}>
        {sourceMode ? (
          <span className={styles.sourceHint}>
            {t('common.richEditor.sourceHint', { defaultValue: '可直接改 HTML，保存后回到预览' })}
          </span>
        ) : null}
        <span className={styles.count}>
          {plainLength}/{maxPlainLength}
        </span>
      </div>
    </div>
  );
};

export default SimpleRichTextEditor;
