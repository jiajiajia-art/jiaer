import React from 'react';
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
    return (
        <div className={styles.storylineSection}>
            <div
                className={styles.storylineHeader}
                style={{ marginBottom: isExpanded ? '8px' : '0', cursor: 'pointer' }}
                onClick={onToggleExpand}
            >
                <span className={styles.fieldLabel}>文风要求（可选）</span>
                <MdArrowDropDown size={30} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
            {isExpanded && (
                <>
                    <span className={styles.fieldHint} style={{ marginBottom: '8px', display: 'block' }}>
                        限定语言风格、叙述视角、禁用词汇等，帮助 AI 保持统一语气。
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

