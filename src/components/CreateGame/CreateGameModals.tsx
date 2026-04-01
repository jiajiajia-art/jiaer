import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
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

const AVG_INVITE_CODE = 'AVG2025DEV';

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
    const [isInviteCodeModalOpen, setIsInviteCodeModalOpen] = useState(false);
    const [inviteCodeInput, setInviteCodeInput] = useState('');
    const [inviteCodeError, setInviteCodeError] = useState('');

    const handleAvgClick = () => {
        if (isMiniProgram) {
            // 小程序端只开放 TXT，AVG 统一引导去 PC 端。
            onCloseCreateTypeModal();
            onOpenMiniProgramTip('avg');
            return;
        }

        setIsInviteCodeModalOpen(true);
        setInviteCodeError('');
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

    const handleInviteCodeConfirm = () => {
        if (!inviteCodeInput.trim()) {
            setInviteCodeError('请输入邀请码');
            return;
        }

        if (inviteCodeInput.trim() === AVG_INVITE_CODE) {
            setIsInviteCodeModalOpen(false);
            setInviteCodeInput('');
            setInviteCodeError('');
            onSelectGameType('avg');
            toast.success('验证成功');
        } else {
            setInviteCodeError('邀请码错误，请重新输入');
            setInviteCodeInput('');
        }
    };

    const handleInviteCodeCancel = () => {
        setIsInviteCodeModalOpen(false);
        setInviteCodeInput('');
        setInviteCodeError('');
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
                                className={`${styles.createTypeOption} ${styles.createTypeOptionRequiresCode}`}
                                onClick={handleAvgClick}
                            >
                                <span>AVG</span>
                                <span className={styles.createTypeOptionLockedTag}>
                                    {isMiniProgram ? '需邀请码' : '需邀请码'}
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

            {isInviteCodeModalOpen && (
                <div
                    className={styles.createTypeModalOverlay}
                    onClick={handleInviteCodeCancel}
                >
                    <div
                        className={styles.createTypeModal}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className={styles.createTypeModalHeader}>
                            <div className={styles.createTypeModalTitle}>输入邀请码</div>
                            <button
                                type="button"
                                onClick={handleInviteCodeCancel}
                                className={styles.inviteCodeCloseButton}
                                aria-label="关闭"
                            >
                                ×
                            </button>
                        </div>
                        <div className={styles.createTypeModalDesc}>
                            该功能需要邀请码才能使用，请输入正确的邀请码。
                        </div>
                        <div className={styles.inviteCodeInputContainer}>
                            <input
                                type="text"
                                className={`${styles.inviteCodeInput} ${inviteCodeError ? styles.inviteCodeInputError : ''}`}
                                value={inviteCodeInput}
                                onChange={(event) => {
                                    setInviteCodeInput(event.target.value);
                                    if (inviteCodeError) {
                                        setInviteCodeError('');
                                    }
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        handleInviteCodeConfirm();
                                    }
                                }}
                                placeholder="请输入邀请码"
                                autoFocus
                            />
                            {inviteCodeError && (
                                <div className={styles.inviteCodeErrorText}>{inviteCodeError}</div>
                            )}
                        </div>
                        <div className={styles.createTypeModalFooter}>
                            <button
                                type="button"
                                onClick={handleInviteCodeCancel}
                                className={styles.createTypeCancelButton}
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={handleInviteCodeConfirm}
                                className={styles.inviteCodeConfirmButton}
                            >
                                确认
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CreateGameModals;
