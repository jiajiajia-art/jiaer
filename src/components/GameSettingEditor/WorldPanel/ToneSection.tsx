import React from 'react';
import { useTranslation } from 'react-i18next';
import { MdKeyboardArrowDown } from 'react-icons/md';
import styles from './WorldPanel.module.css';

interface ToneSectionProps {
    value: string;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onChange: (value: string) => void;
}

/**
 * 功能注释：文风区块对齐效果图设置行——折叠时仅标题 + chevron，展开后再露出说明与输入。
 */
const ToneSection: React.FC<ToneSectionProps> = ({
    value,
    isExpanded,
    onToggleExpand,
    onChange,
}) => {
    const { t } = useTranslation();

    return (
        <div className={styles.storylineSection}>
            <button
                type="button"
                className={styles.accordionTrigger}
                onClick={onToggleExpand}
                aria-expanded={isExpanded}
            >
                <span className={styles.accordionTitle}>{t('createGame.toneLabel')}</span>
                <MdKeyboardArrowDown
                    className={`${styles.accordionChevron} ${isExpanded ? styles.accordionChevronOpen : ''}`}
                    size={22}
                    aria-hidden
                />
            </button>
            {isExpanded && (
                <div className={styles.accordionBody}>
                    <span className={styles.fieldHint}>{t('createGame.toneHint')}</span>
                    <textarea
                        rows={4}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                </div>
            )}
        </div>
    );
};

export default ToneSection;
