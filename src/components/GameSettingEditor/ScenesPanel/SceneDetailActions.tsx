import React from 'react';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    
    if (isAddingNew) {
        return (
            <div className={styles.actionsContainer}>
                <button className={styles.ghostSmall} onClick={onConfirmAddNew}>
                    {t('common.confirmAdd')}
                </button>
                <button className={styles.ghostSmall} onClick={onCancelAddNew}>
                    {t('common.cancel')}
                </button>
            </div>
        );
    }

    if (activeSubsceneId) {
        return (
            <div className={styles.actionsContainer}>
                <button className={styles.ghostSmall} onClick={onConfirmSubsceneEdit}>
                    {isAddingNewSubscene ? t('common.confirmAdd') : t('common.confirmEdit')}
                </button>
                {isAddingNewSubscene && (
                    <button className={styles.ghostSmall} onClick={onCancelAddNewSubscene}>
                        {t('common.cancel')}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={styles.actionsContainer}>
            <button className={styles.ghostSmall} onClick={onConfirmEdit}>
                {t('common.confirmEdit')}
            </button>
        </div>
    );
};

export default SceneDetailActions;
