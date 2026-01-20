import React, { useState } from 'react';
import styles from './CreateGameModals.module.css';
import MobileTipModal from './MobileTipModal';
import { toast } from 'react-hot-toast';

interface CreateGameModalsProps {
    isCreateTypeModalOpen: boolean;
    isMobileTipModalOpen: boolean;
    onCloseCreateTypeModal: () => void;
    onCloseMobileTipModal: () => void;
    onSelectGameType: (type: 'avg' | 'rpg' | 'txt' | 'custom') => void;
}

const AVG_INVITE_CODE = 'AVG2025DEV';

const CreateGameModals: React.FC<CreateGameModalsProps> = ({
    isCreateTypeModalOpen,
    isMobileTipModalOpen,
    onCloseCreateTypeModal,
    onCloseMobileTipModal,
    onSelectGameType,
}) => {
    const [isInviteCodeModalOpen, setIsInviteCodeModalOpen] = useState(false);
    const [inviteCodeInput, setInviteCodeInput] = useState('');
    const [inviteCodeError, setInviteCodeError] = useState('');

    const handleAvgClick = () => {
        setIsInviteCodeModalOpen(true);
        setInviteCodeError('');
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

    const handleInviteCodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInviteCodeInput(e.target.value);
        // 输入时清除错误提示
        if (inviteCodeError) {
            setInviteCodeError('');
        }
    };

    const handleInviteCodeKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleInviteCodeConfirm();
        }
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
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.createTypeModalHeader}>
                            <div className={styles.createTypeModalTitle}>
                                选择需创建游戏类型
                            </div>
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
                                <span className={styles.createTypeOptionLockedTag}>需邀请码</span>
                            </button>
                            <button
                                className={styles.createTypeOption}
                                onClick={() => onSelectGameType('custom')}
                            >
                                <span>自定义</span>
                                <span className={styles.createTypeOptionRecommend}>新</span>
                            </button>
                            <button
                                className={`${styles.createTypeOption} ${styles.createTypeOptionDisabled}`}
                                onClick={() => onSelectGameType('rpg')}
                                disabled={true}
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

            {/* 移动端提示弹窗 */}
            <MobileTipModal
                isOpen={isMobileTipModalOpen}
                onClose={onCloseMobileTipModal}
                message="创作功能暂不支持移动端，请在电脑上访问以获得更好的体验"
            />

            {/* 邀请码输入弹窗 */}
            {isInviteCodeModalOpen && (
                <div
                    className={styles.createTypeModalOverlay}
                    onClick={handleInviteCodeCancel}
                >
                    <div
                        className={styles.createTypeModal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.createTypeModalHeader}>
                            <div className={styles.createTypeModalTitle}>
                                输入邀请码
                            </div>
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
                                onChange={handleInviteCodeInputChange}
                                onKeyPress={handleInviteCodeKeyPress}
                                placeholder="请输入邀请码"
                                autoFocus
                            />
                            {inviteCodeError && (
                                <div className={styles.inviteCodeErrorText}>
                                    {inviteCodeError}
                                </div>
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
