import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { auth } from '../../api/account/authApi';
import { useAuthStore } from '../../store/useAuthStore';
import { getApiErrorMessage } from '../../utils/error';
import styles from './EditNicknameModal.module.css';

export const PROFILE_NICKNAME_MAX_LENGTH = 20;

type EditNicknameModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

const EditNicknameModal: React.FC<EditNicknameModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { user, updateUser } = useAuthStore();
    const [nicknameDraft, setNicknameDraft] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setNicknameDraft(user?.user?.nickname || user?.user?.name || '');
    }, [isOpen, user?.user?.nickname, user?.user?.name]);

    if (!isOpen) return null;

    const handleClose = () => {
        if (isSaving) return;
        onClose();
    };

    const handleConfirm = async () => {
        const nextName = nicknameDraft.trim();
        if (!nextName) {
            toast.error(t('profile.enterNewNickname'));
            return;
        }
        if (nextName.length > PROFILE_NICKNAME_MAX_LENGTH) {
            toast.error(t('profile.nicknameTip'));
            return;
        }
        if (nextName === (user?.user?.nickname || '').trim()) {
            onClose();
            return;
        }

        setIsSaving(true);
        try {
            const response = await auth.updateUserInfo(nextName);
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('common.error'));
            }
            updateUser(response.data.data);
            toast.success(t('common.success'));
            onClose();
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={handleClose}>
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-label={t('profile.editNickname')}
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={handleClose}
                    disabled={isSaving}
                    aria-label={t('common.close')}
                >
                    <span className={styles.closeIcon} aria-hidden="true" />
                </button>
                <h3 className={styles.title}>{t('profile.editNickname')}</h3>
                <div className={styles.body}>
                    <input
                        className={styles.input}
                        value={nicknameDraft}
                        onChange={(event) =>
                            setNicknameDraft(event.target.value.slice(0, PROFILE_NICKNAME_MAX_LENGTH))
                        }
                        placeholder={t('profile.enterNewNickname')}
                        maxLength={PROFILE_NICKNAME_MAX_LENGTH}
                        autoFocus
                        disabled={isSaving}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void handleConfirm();
                            }
                        }}
                    />
                    <p className={styles.tip}>{t('profile.nicknameTip')}</p>
                </div>
                <button
                    type="button"
                    className={styles.confirm}
                    onClick={() => void handleConfirm()}
                    disabled={isSaving}
                >
                    {isSaving ? t('profile.saving') : t('profile.confirm')}
                </button>
            </div>
        </div>
    );
};

export default EditNicknameModal;
