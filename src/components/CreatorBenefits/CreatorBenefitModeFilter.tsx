import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IoCheckmark, IoChevronDown } from 'react-icons/io5';
import type { CreatorBenefitMode } from '../../lib/creatorLevelView';
import { HOME_LIST_MODE_OPTIONS } from '../../utils/gameBrowseFilters';
import styles from './CreatorBenefitModeFilter.module.css';

interface CreatorBenefitModeFilterProps {
    value: CreatorBenefitMode;
    onChange: (value: CreatorBenefitMode) => void;
}

const CreatorBenefitModeFilter: React.FC<CreatorBenefitModeFilterProps> = ({ value, onChange }) => {
    const { t } = useTranslation();
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const options = useMemo(() => HOME_LIST_MODE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey || option.label),
    })), [t]);
    const current = options.find((option) => option.value === value) || options[0];

    useEffect(() => {
        if (!open) return undefined;

        const handlePointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    return (
        <div ref={rootRef} className={styles.root}>
            <button
                ref={triggerRef}
                type="button"
                className={styles.trigger}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls="creator-benefit-mode-options"
                onClick={() => setOpen((visible) => !visible)}
            >
                <span>{t('categories.mode')}</span>
                <strong>{current.label}</strong>
                <IoChevronDown className={open ? styles.chevronOpen : ''} aria-hidden="true" />
            </button>
            {open ? (
                <div id="creator-benefit-mode-options" className={styles.menu} role="listbox" aria-label={t('categories.mode')}>
                    {options.map((option) => {
                        const selected = option.value === value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                className={selected ? styles.optionActive : styles.option}
                                role="option"
                                aria-selected={selected}
                                onClick={() => {
                                    onChange(option.value);
                                    setOpen(false);
                                    triggerRef.current?.focus();
                                }}
                            >
                                <span>{option.label}</span>
                                {selected ? <IoCheckmark aria-hidden="true" /> : null}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
};

export default CreatorBenefitModeFilter;
