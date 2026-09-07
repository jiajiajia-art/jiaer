import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IconType } from 'react-icons';
import { FaDesktop } from 'react-icons/fa';
import { HiOutlinePuzzle, HiOutlineUserGroup } from 'react-icons/hi';
import {
    MdAutoStories,
    MdOutlineMovie,
    MdSportsEsports,
} from 'react-icons/md';
import { IoChevronForward } from 'react-icons/io5';
import styles from './CreateGameModals.module.css';
import MobileTipModal from './MobileTipModal';
import type { CreatorGameType } from '../../utils/miniProgram';

const IVG_TOOL_DOWNLOAD_FILE_NAME = 'FunloomTool.zip';
const IVG_TOOL_DOWNLOAD_URL = 'https://kurangames.com/download/FunloomTool.zip';
const IVG_TUTORIAL_URL = 'https://avyx4ypb3lx.feishu.cn/docx/WTcZdQPipofJq1xb1A4caq6Tngd';

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

type OptionBadge = 'recommend' | 'new' | 'locked';

/** 功能注释：缩略图色调变体，让五种模式一眼可辨，避免同色空方块 */
type ThumbTone = 'txt' | 'avg' | 'ivg' | 'custom' | 'rpg';

const THUMB_TONE_CLASS: Record<ThumbTone, string> = {
    txt: styles.createTypeOptionThumbTxt,
    avg: styles.createTypeOptionThumbAvg,
    ivg: styles.createTypeOptionThumbIvg,
    custom: styles.createTypeOptionThumbCustom,
    rpg: styles.createTypeOptionThumbRpg,
};

/** 功能注释：类型行统一左图标缩略图 + 标题标签 + 右箭头，对齐暗色创作类型页 */
const TypeOptionRow: React.FC<{
    title: string;
    badge?: OptionBadge;
    badgeText?: string;
    hint: string;
    icon: IconType;
    tone: ThumbTone;
    disabled?: boolean;
    onClick?: () => void;
}> = ({ title, badge, badgeText, hint, icon: Icon, tone, disabled, onClick }) => (
    <button
        type="button"
        className={`${styles.createTypeOption} ${disabled ? styles.createTypeOptionDisabled : ''}`}
        onClick={onClick}
        disabled={disabled}
    >
        <span
            className={`${styles.createTypeOptionThumb} ${THUMB_TONE_CLASS[tone]}`}
            aria-hidden="true"
        >
            <Icon className={styles.createTypeOptionIcon} />
        </span>
        <span className={styles.createTypeOptionBody}>
            <span className={styles.createTypeOptionTitleRow}>
                <span className={styles.createTypeOptionName}>{title}</span>
                {badge && badgeText ? (
                    <span
                        className={
                            badge === 'recommend'
                                ? styles.createTypeOptionRecommend
                                : badge === 'locked'
                                  ? styles.createTypeOptionLocked
                                  : styles.createTypeOptionLockedTag
                        }
                    >
                        {badgeText}
                    </span>
                ) : null}
            </span>
            <span className={styles.createTypeOptionHint}>{hint}</span>
        </span>
        <IoChevronForward className={styles.createTypeOptionChevron} aria-hidden="true" />
    </button>
);

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
    const optionHint = t('createGame.optionHint');

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
                            <TypeOptionRow
                                title={t('createGame.txtMode')}
                                badge="recommend"
                                badgeText={t('createGame.recommend')}
                                hint={optionHint}
                                icon={MdAutoStories}
                                tone="txt"
                                onClick={() => onSelectGameType('txt')}
                            />
                            <TypeOptionRow
                                title={t('createGame.avgBeta')}
                                badge="new"
                                badgeText={t('createGame.new')}
                                hint={optionHint}
                                icon={HiOutlineUserGroup}
                                tone="avg"
                                onClick={handleAvgClick}
                            />
                            <TypeOptionRow
                                title={t('createGame.interactiveVideo')}
                                badge="new"
                                badgeText={t('createGame.new')}
                                hint={optionHint}
                                icon={MdOutlineMovie}
                                tone="ivg"
                                onClick={handleIvgClick}
                            />
                            <TypeOptionRow
                                title={t('createGame.custom')}
                                badge="new"
                                badgeText={t('createGame.new')}
                                hint={optionHint}
                                icon={HiOutlinePuzzle}
                                tone="custom"
                                onClick={handleCustomClick}
                            />
                            <TypeOptionRow
                                title="RPG"
                                badge="locked"
                                badgeText={t('createGame.locked')}
                                hint={optionHint}
                                icon={MdSportsEsports}
                                tone="rpg"
                                disabled
                                onClick={() => onSelectGameType('rpg')}
                            />
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
                                href={IVG_TOOL_DOWNLOAD_URL}
                                download={IVG_TOOL_DOWNLOAD_FILE_NAME}
                            >
                                <FaDesktop className={styles.ivgToolActionIcon} aria-hidden="true" />
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
