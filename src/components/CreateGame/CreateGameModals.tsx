import React, { useState } from 'react';
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
                            <div className={styles.createTypeModalTitle}>选择需创建游戏类型</div>
                        </div>
                        <div className={styles.createTypeModalDesc}>
                            请选择你要创作的游戏形态，我们会为你匹配合适的创作流程。
                        </div>
                        <div className={styles.createTypeOptions}>
                            <button
                                className={styles.createTypeOption}
                                onClick={() => onSelectGameType('txt')}
                            >
                                <span>TXT</span>
                                <span className={styles.createTypeOptionRecommend}>推荐</span>
                            </button>
                            <button
                                className={styles.createTypeOption}
                                onClick={handleAvgClick}
                            >
                                <span>AVG（内测中）</span>
                                <span className={styles.createTypeOptionLockedTag}>
                                    {isMiniProgram ? '新' : '新'}
                                </span>
                            </button>
                            <button
                                className={styles.createTypeOption}
                                onClick={handleIvgClick}
                            >
                                <span>互动影游</span>
                                <span className={styles.createTypeOptionRecommend}>
                                    新
                                </span>
                            </button>
                            <button
                                className={styles.createTypeOption}
                                onClick={handleCustomClick}
                            >
                                <span>自定义</span>
                                <span className={styles.createTypeOptionRecommend}>
                                    {isMiniProgram ? '新' : '新'}
                                </span>
                            </button>
                            <button
                                className={`${styles.createTypeOption} ${styles.createTypeOptionDisabled}`}
                                onClick={() => onSelectGameType('rpg')}
                                disabled
                            >
                                <span>RPG</span>
                                <span className={styles.createTypeOptionLocked}>待解锁</span>
                            </button>
                        </div>
                        <div className={styles.createTypeModalFooter}>
                            <button
                                type="button"
                                onClick={onCloseCreateTypeModal}
                                className={styles.createTypeCancelButton}
                            >
                                取消
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
                            <div className={styles.createTypeModalTitle}>互动影游创作工具</div>
                        </div>
                        <div className={styles.createTypeModalDesc}>
                            下载 Windows 创作工具开始制作互动影游，也可以先查看教程了解完整流程。
                        </div>
                        <div className={styles.ivgToolActions}>
                            <a
                                className={`${styles.ivgToolAction} ${styles.ivgToolDownloadAction}`}
                                href={ivgToolDownloadUrl}
                                download={IVG_TOOL_DOWNLOAD_FILE_NAME}
                            >
                                <FaWindows className={styles.ivgToolActionIcon} aria-hidden="true" />
                                <span>下载工具</span>
                            </a>
                            <a
                                className={styles.ivgToolAction}
                                href={IVG_TUTORIAL_URL}
                                target="_blank"
                                rel="noreferrer"
                            >
                                教程引导
                            </a>
                        </div>
                        <div className={styles.createTypeModalFooter}>
                            <button
                                type="button"
                                onClick={handleCloseIvgToolModal}
                                className={styles.createTypeCancelButton}
                            >
                                取消
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
                bindPhoneActionText="建议先绑定手机号"
                bindPhoneActionHint="绑定后可在小程序端和 PC 端使用同一个账号。"
                onBindPhoneAction={onOpenBindPhoneGuide}
            />
        </>
    );
};

export default CreateGameModals;
