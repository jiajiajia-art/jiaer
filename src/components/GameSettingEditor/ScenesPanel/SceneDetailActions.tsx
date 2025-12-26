import React from 'react';
import styles from './SceneDetailActions.module.css';

interface SceneDetailActionsProps {
    isAddingNew: boolean;
    activeSubsceneId: string | null;
    isAddingNewSubscene: boolean;
    onConfirmAddNew: () => void;
    onCancelAddNew: () => void;
    onConfirmSubsceneEdit: () => void;
    onCancelAddNewSubscene: () => void;
    onConfirmEdit: () => void;
}

const SceneDetailActions: React.FC<SceneDetailActionsProps> = ({
    isAddingNew,
    activeSubsceneId,
    isAddingNewSubscene,
    onConfirmAddNew,
    onCancelAddNew,
    onConfirmSubsceneEdit,
    onCancelAddNewSubscene,
    onConfirmEdit,
}) => {
    if (isAddingNew) {
        return (
            <div className={styles.actionsContainer}>
                <button className={styles.ghostSmall} onClick={onConfirmAddNew}>
                    确认增加
                </button>
                <button className={styles.ghostSmall} onClick={onCancelAddNew}>
                    取消
                </button>
            </div>
        );
    }

    if (activeSubsceneId) {
        return (
            <div className={styles.actionsContainer}>
                <button className={styles.ghostSmall} onClick={onConfirmSubsceneEdit}>
                    {isAddingNewSubscene ? '确认增加' : '确认修改'}
                </button>
                {isAddingNewSubscene && (
                    <button className={styles.ghostSmall} onClick={onCancelAddNewSubscene}>
                        取消
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={styles.actionsContainer}>
            <button className={styles.ghostSmall} onClick={onConfirmEdit}>
                确认修改
            </button>
        </div>
    );
};

export default SceneDetailActions;

