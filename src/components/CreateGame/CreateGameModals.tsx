import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './CreateGameModals.module.css';
import MobileTipModal from './MobileTipModal';
import type { CreatorGameType } from '../../utils/miniProgram';

interface CreateGameModalsProps {
    isCreateTypeModalOpen: boolean;
    isMobileTipModalOpen: boolean;
    isMiniProgram: boolean;
    mobileTipMessage: string;
    mobileTipTitle?: string;
    mobileTipLinkUrl?: string;
    onCloseCreateTypeModal: () => void;
    onCloseMobileTipModal: () => void;
    onSelectGameType: (type: CreatorGameType) => void;
    onOpenMiniProgramTip: (type: Exclude<CreatorGameType, 'txt' | 'rpg'>) => void;
    onOpenBindPhoneGuide?: () => void;
}

const CreateGameModals: React.FC<CreateGameModalsProps> = ({
    isCreateTypeModalOpen,
    isMobileTipModalOpen,
    isMiniProgram,
    mobileTipMessage,
    mobileTipTitle,
    mobileTipLinkUrl,
    onCloseCreateTypeModal,
    onCloseMobileTipModal,
    onSelectGameType,
    onOpenMiniProgramTip,
    onOpenBindPhoneGuide,
}) => {
    const { t } = useTranslation();
    const handleAvgClick = () => {
        if (isMiniProgram) {
            // 小程序端只开放 TXT，AVG 统一引导去 PC 端。
            onCloseCreateTypeModal();
            onOpenMiniProgramTip('avg');
            return;
        }
        onSelectGameType('avg');
    };

    const handleCustomClick = () => {
        if (isMiniProgram) {
            // 小程序端暂不承载自定义模式编辑，统一给出 PC 引导。
            onCloseCreateTypeModal();
            onOpenMiniProgramTip('custom');
            return;
        }

        onSelectGameType('custom');
    };
    return (
        <>
            {isCreateTypeModalOpen && (
                <div
                    className={styles.createTypeModalOverlay}
                    onClick={onCloseCreateTypeModal}
                >
                    <div
                        className={styles.createTypeModal}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className={styles.createTypeModalHeader}>
                            <div className={styles.createTypeModalTitle}>{t('createGame.selectGameTypeTitle')}</div>
                        </div>
                        <div className={styles.createTypeModalDesc}>
                            {t('createGame.selectGameTypeDesc')}
                        </div>
                        <div className={styles.createTypeOptions}>
                            <button
                                className={styles.createTypeOption}
                                onClick={() => onSelectGameType('txt')}
                            >
                                <span>TXT</span>
                                <span className={styles.createTypeOptionRecommend}>{t('createGame.recommend')}</span>
                            </button>
                            <button
                                className={styles.createTypeOption}
                                onClick={handleAvgClick}
                            >
                                <span>{t('createGame.avgBeta')}</span>
                                <span className={styles.createTypeOptionLockedTag}>
                                    {isMiniProgram ? t('createGame.new') : t('createGame.new')}
                                </span>
                            </button>
                            <button
                                className={styles.createTypeOption}
                                onClick={handleCustomClick}
                            >
                                <span>{t('createGame.custom')}</span>
                                <span className={styles.createTypeOptionRecommend}>
                                    {isMiniProgram ? t('createGame.new') : t('createGame.new')}
                                </span>
                            </button>
                            <button
                                className={`${styles.createTypeOption} ${styles.createTypeOptionDisabled}`}
                                onClick={() => onSelectGameType('rpg')}
                                disabled
                            >
                                <span>RPG</span>
                                <span className={styles.createTypeOptionLocked}>{t('createGame.locked')}</span>
                            </button>
                        </div>
                        <div className={styles.createTypeModalFooter}>
                            <button
                                type="button"
                                onClick={onCloseCreateTypeModal}
                                className={styles.createTypeCancelButton}
                            >
                                {t('createGame.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <MobileTipModal
                isOpen={isMobileTipModalOpen}
                onClose={onCloseMobileTipModal}
                title={mobileTipTitle}
                message={mobileTipMessage}
                linkUrl={mobileTipLinkUrl}
                bindPhoneActionText={t('createGame.bindPhoneFirst')}
                bindPhoneActionHint={t('createGame.bindPhoneTip')}
                onBindPhoneAction={onOpenBindPhoneGuide}
            />
        </>
    );
};

export default CreateGameModals;
