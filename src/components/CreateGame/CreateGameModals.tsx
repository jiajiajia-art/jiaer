import React from 'react';
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
                                <span>AVG</span>
                                <span className={styles.createTypeOptionLockedTag}>
                                    {isMiniProgram ? '新' : '新'}
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
