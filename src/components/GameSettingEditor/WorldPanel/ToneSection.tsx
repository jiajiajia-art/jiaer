import React from 'react';
import { useTranslation } from 'react-i18next';
import { MdArrowDropDown } from 'react-icons/md';
import styles from './WorldPanel.module.css';

interface ToneSectionProps {
    value: string;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onChange: (value: string) => void;
}

const ToneSection: React.FC<ToneSectionProps> = ({
    value,
    isExpanded,
    onToggleExpand,
    onChange,
}) => {
    const { t } = useTranslation();

    return (
        <div className={styles.storylineSection}>
            <div
                className={styles.storylineHeader}
                style={{ marginBottom: isExpanded ? '8px' : '0', cursor: 'pointer' }}
                onClick={onToggleExpand}
            >
                <span className={styles.fieldLabel}>{t('createGame.toneLabel')}</span>
                <MdArrowDropDown size={30} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
            {isExpanded && (
                <>
                    <span className={styles.fieldHint} style={{ marginBottom: '8px', display: 'block' }}>
                        {t('createGame.toneHint')}
                    </span>
                    <textarea
                        rows={4}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                </>
            )}
        </div>
    );
};

export default ToneSection;

