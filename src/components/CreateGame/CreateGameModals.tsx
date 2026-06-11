import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaWindows } from 'react-icons/fa';
import styles from './CreateGameModals.module.css';
import MobileTipModal from './MobileTipModal';
import type { CreatorGameType } from '../../utils/miniProgram';

const IVG_TOOL_DOWNLOAD_FILE_NAME = 'Funloom互动影游工具-Windows.zip';
const IVG_TOOL_DOWNLOAD_PATH = `/pdf/${IVG_TOOL_DOWNLOAD_FILE_NAME}`;
const IVG_TUTORIAL_URL = 'https://avyx4ypb3lx.feishu.cn/docx/WTcZdQPipofJq1xb1A4caq6Tngd';

const getPublicAssetUrl = (path: string) =>
    `${import.meta.env.BASE_URL}${path.startsWith('/') ? path.slice(1) : path}`;

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
    const [isIvgToolModalOpen, setIsIvgToolModalOpen] = useState(false);
    const ivgToolDownloadUrl = getPublicAssetUrl(IVG_TOOL_DOWNLOAD_PATH);

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

    const handleIvgClick = () => {
        if (isMiniProgram) {
            onCloseCreateTypeModal();
            onOpenMiniProgramTip('ivg');
            return;
        }

        onCloseCreateTypeModal();
        setIsIvgToolModalOpen(true);
    };

    const handleCloseIvgToolModal = () => {
        setIsIvgToolModalOpen(false);
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
                                onClick={handleIvgClick}
                            >
                                <span>{t('createGame.interactiveVideo')}</span>
                                <span className={styles.createTypeOptionRecommend}>
                                    {t('createGame.new')}
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

            {isIvgToolModalOpen && (
                <div
                    className={styles.createTypeModalOverlay}
                    onClick={handleCloseIvgToolModal}
                >
                    <div
                        className={`${styles.createTypeModal} ${styles.ivgToolModal}`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className={styles.createTypeModalHeader}>
                            <div className={styles.createTypeModalTitle}>{t('createGame.ivgToolTitle')}</div>
                        </div>
                        <div className={styles.createTypeModalDesc}>
                            {t('createGame.ivgToolDesc')}
                        </div>
                        <div className={styles.ivgToolActions}>
                            <a
                                className={`${styles.ivgToolAction} ${styles.ivgToolDownloadAction}`}
                                href={ivgToolDownloadUrl}
                                download={IVG_TOOL_DOWNLOAD_FILE_NAME}
                            >
                                <FaWindows className={styles.ivgToolActionIcon} aria-hidden="true" />
                                <span>{t('createGame.downloadTool')}</span>
                            </a>
                            <a
                                className={styles.ivgToolAction}
                                href={IVG_TUTORIAL_URL}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {t('createGame.tutorialGuide')}
                            </a>
                        </div>
                        <div className={styles.createTypeModalFooter}>
                            <button
                                type="button"
                                onClick={handleCloseIvgToolModal}
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
