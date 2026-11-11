import React, { useEffect, useId, useRef, useState } from 'react';
import styles from './PanelSelect.module.css';

export type PanelSelectOption = {
  value: string;
  label: string;
};

interface PanelSelectProps {
  value: string;
  options: PanelSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** 无障碍名称；外层已有 label 时可省略 */
  'aria-label'?: string;
  className?: string;
}

/**
 * 功能注释：局内面板暗色下拉（替代原生 select）。
 * 关闭态与输入框同系；展开为自绘列表，主题红高亮选中项。
 */
const PanelSelect: React.FC<PanelSelectProps> = ({
  value,
  options,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
  className,
}) => {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${open ? styles.open : ''} ${className || ''}`}
    >
      <button
        type="button"
        className={styles.trigger}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.value}>{selected?.label || ''}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      {open ? (
        <ul
          id={listId}
          className={styles.menu}
          role="listbox"
          aria-activedescendant={selected ? `${listId}-${selected.value}` : undefined}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  id={`${listId}-${opt.value}`}
                  role="option"
                  aria-selected={active}
                  className={`${styles.option} ${active ? styles.optionActive : ''}`}
                  onClick={() => pick(opt.value)}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};

export default PanelSelect;
