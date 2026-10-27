import React, { useEffect, useMemo, useState } from 'react';
import { IoRadioButtonOff, IoRadioButtonOn } from 'react-icons/io5';
import CreatorEarningsModalShell from './CreatorEarningsModalShell';
import styles from './CreatorEarnings.module.css';

interface WorkOption {
    fileId: string;
    title: string;
}

interface Props {
    open: boolean;
    value: string;
    works: WorkOption[];
    onClose: () => void;
    onConfirm: (fileId: string) => void;
}

const CreatorWorkSelectModal: React.FC<Props> = ({ open, value, works, onClose, onConfirm }) => {
    const [draftFileId, setDraftFileId] = useState(value);

    useEffect(() => {
        if (open) setDraftFileId(value);
    }, [open, value]);

    const selectedTitle = useMemo(() => (
        draftFileId ? works.find((work) => work.fileId === draftFileId)?.title || draftFileId : '全部作品（汇总展示）'
    ), [draftFileId, works]);

    const options = [{ fileId: '', title: '全部作品' }, ...works];

    return (
        <CreatorEarningsModalShell
            open={open}
            title="选择作品"
            onClose={onClose}
            actions={(
                <div className={styles.selectorActions}>
                    <button type="button" className={styles.secondaryButton} onClick={onClose}>取消</button>
                    <button type="button" className={styles.primaryButton} onClick={() => onConfirm(draftFileId)}>确认</button>
                </div>
            )}
        >
            <p className={styles.selectorCurrent}>当前已选：{selectedTitle}</p>
            <div className={styles.workSelectorList} role="radiogroup" aria-label="趋势作品筛选">
                {options.map((work) => {
                    const selected = work.fileId === draftFileId;
                    return (
                        <button
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            className={`${styles.workSelectorOption} ${selected ? styles.workSelectorOptionActive : ''}`}
                            key={work.fileId || 'all'}
                            onClick={() => setDraftFileId(work.fileId)}
                        >
                            <span>{work.title}</span>
                            {selected ? <IoRadioButtonOn aria-hidden="true" /> : <IoRadioButtonOff aria-hidden="true" />}
                        </button>
                    );
                })}
            </div>
        </CreatorEarningsModalShell>
    );
};

export default CreatorWorkSelectModal;
