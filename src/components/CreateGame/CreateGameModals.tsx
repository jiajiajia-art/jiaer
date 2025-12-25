import React from 'react';
import styles from './CreateGameModals.module.css';
import MobileTipModal from './MobileTipModal';

interface CreateGameModalsProps {
    isCreateTypeModalOpen: boolean;
    isMobileTipModalOpen: boolean;
    onCloseCreateTypeModal: () => void;
    onCloseMobileTipModal: () => void;
    onSelectGameType: (type: 'avg' | 'rpg' | 'txt') => void;
}

const CreateGameModals: React.FC<CreateGameModalsProps> = ({
    isCreateTypeModalOpen,
    isMobileTipModalOpen,
    onCloseCreateTypeModal,
    onCloseMobileTipModal,
    onSelectGameType,
}) => {
    return (
        <>
            {/* 创作类型选择弹窗 */}
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
                                className={styles.createTypeOption}
                                onClick={() => onSelectGameType('avg')}
                            >
                                <span>AVG</span>
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
        </>
    );
};

export default CreateGameModals;

