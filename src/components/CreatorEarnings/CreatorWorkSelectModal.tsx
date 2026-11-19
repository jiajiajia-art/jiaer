import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    const [draftFileId, setDraftFileId] = useState(value);

    useEffect(() => {
        if (open) setDraftFileId(value);
    }, [open, value]);

    const selectedTitle = useMemo(() => (
        draftFileId ? works.find((work) => work.fileId === draftFileId)?.title || draftFileId : t('creatorCenter.allWorksSummary')
    ), [draftFileId, t, works]);

    const selectedNowNodes = useMemo(() => {
        const full = t('creatorCenter.selectedNow', { title: selectedTitle });
        const idx = full.lastIndexOf(selectedTitle);
        if (idx < 0) return full;
        return (
            <>
                {full.slice(0, idx)}
                <strong>{selectedTitle}</strong>
                {full.slice(idx + selectedTitle.length)}
            </>
        );
    }, [selectedTitle, t]);

    const options = [{ fileId: '', title: t('creatorCenter.allWorks') }, ...works];

    return (
        <CreatorEarningsModalShell
            open={open}
            title={t('creatorCenter.selectWorkTitle')}
            onClose={onClose}
            actions={(
                <div className={styles.selectorActions}>
                    <button type="button" className={styles.secondaryButton} onClick={onClose}>{t('common.cancel')}</button>
                    <button type="button" className={styles.primaryButton} onClick={() => onConfirm(draftFileId)}>{t('common.confirm')}</button>
                </div>
            )}
        >
            <p className={styles.selectorCurrent}>{selectedNowNodes}</p>
            <div className={styles.workSelectorList} role="radiogroup" aria-label={t('creatorCenter.trendFilterAria')}>
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
