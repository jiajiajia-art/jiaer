/**
 * 运营后台通用「适用题材」多选：以题材标签 chip 形式展示，点选切换，受控组件。
 */
import React from 'react';
import { toggleThemeTagId } from '../../utils/applicableThemeTags';
import styles from './AdminPlayModManager.module.css';

export type ThemeTagOption = { id: number; name: string };

type Props = {
  tags: ThemeTagOption[];
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
};

const ThemeTagPicker: React.FC<Props> = ({ tags, value, onChange, disabled }) => {
  if (!tags.length) return <p className={styles.muted}>暂无可选题材（请先在「特殊题材」里启用）</p>;
  return (
    <div className={styles.themeChips}>
      {tags.map((t) => {
        const on = value.includes(t.id);
        return (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            className={on ? styles.themeChipOn : styles.themeChip}
            aria-pressed={on}
            onClick={() => onChange(toggleThemeTagId(value, t.id))}
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
};

export default ThemeTagPicker;
