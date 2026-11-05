import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { IoClose } from 'react-icons/io5';
import styles from './CreatorBenefitRulesModal.module.css';

interface CreatorBenefitRulesModalProps {
    open: boolean;
    currentLevel?: number | null;
    isSpecialAuthor?: boolean;
    onClose: () => void;
}

const CREATOR_BENEFIT_LEVELS = [
    { levelKey: 'guideLevel1', threshold: 0, conditionKey: null, editorRatio: '10%', customRatio: '55%', level: 1 },
    { levelKey: 'guideLevel2', threshold: 5000, conditionKey: null, editorRatio: '12%', customRatio: '60%', level: 2 },
    { levelKey: 'guideLevel3', threshold: 10000, conditionKey: null, editorRatio: '15%', customRatio: '65%', level: 3 },
    { levelKey: 'guideLevel4', threshold: null, conditionKey: 'guideContracted', editorRatio: '20%', customRatio: '70%', level: 4 },
    { levelKey: 'guideLevel5', threshold: null, conditionKey: 'guideContracted', editorRatio: '20%', customRatio: '75%', level: 5 },
    { levelKey: 'guideSpecial', threshold: null, conditionKey: 'guideConfigured', editorRatio: '20%-25%', customRatio: '70%-85%', level: null },
] as const;

const formatNumber = (value: number) => value.toLocaleString('zh-CN');

const CreatorBenefitRulesModal: React.FC<CreatorBenefitRulesModalProps> = ({
    open,
    currentLevel = null,
    isSpecialAuthor = false,
    onClose,
}) => {
    const { t } = useTranslation();

    useEffect(() => {
        if (!open) return undefined;
        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose, open]);

    if (!open) return null;

    const isCurrent = (level: number | null) => (
        level === null ? isSpecialAuthor : !isSpecialAuthor && currentLevel === level
    );

    return (
        <div
            className={styles.overlay}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="creator-benefit-rules-title"
                aria-describedby="creator-benefit-rules-description"
            >
                <header className={styles.header}>
                    <div>
                        <h2 id="creator-benefit-rules-title">{t('creatorBenefits.guideTitle')}</h2>
                        <p id="creator-benefit-rules-description">{t('creatorBenefits.guideDescription')}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label={t('creatorBenefits.guideClose')} autoFocus>
                        <IoClose aria-hidden="true" />
                    </button>
                </header>

                <div className={styles.tableFrame}>
                    <table>
                        <thead>
                            <tr>
                                <th scope="col">{t('creatorBenefits.guideLevel')}</th>
                                {CREATOR_BENEFIT_LEVELS.map((item) => (
                                    <th className={isCurrent(item.level) ? styles.current : undefined} key={item.levelKey} scope="col">
                                        {t(`creatorBenefits.${item.levelKey}`)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <th scope="row">{t('creatorBenefits.guideUpgradeCondition')}</th>
                                {CREATOR_BENEFIT_LEVELS.map((item) => (
                                    <td className={isCurrent(item.level) ? styles.current : undefined} key={item.levelKey}>
                                        {item.conditionKey
                                            ? t(`creatorBenefits.${item.conditionKey}`)
                                            : item.threshold === 0
                                            ? t('creatorBenefits.guideInitial')
                                            : item.threshold === null
                                                ? t('creatorBenefits.guideNotApplicable')
                                                : t('creatorBenefits.guidePlayThreshold', { count: formatNumber(item.threshold) })}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <th scope="row">{t('creatorBenefits.guideEditorRatio')}</th>
                                {CREATOR_BENEFIT_LEVELS.map((item) => <td className={isCurrent(item.level) ? styles.current : undefined} key={item.levelKey}>{item.editorRatio}</td>)}
                            </tr>
                            <tr>
                                <th scope="row">{t('creatorBenefits.guideCustomRatio')}</th>
                                {CREATOR_BENEFIT_LEVELS.map((item) => <td className={isCurrent(item.level) ? styles.current : undefined} key={item.levelKey}>{item.customRatio}</td>)}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default CreatorBenefitRulesModal;
