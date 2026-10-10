import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { auth } from '../api/account/authApi';
import EditNicknameModal from '../components/Profile/EditNicknameModal';
import { useAuthStore } from '../store/useAuthStore';
import { getApiErrorMessage } from '../utils/error';
import { MAX_UPLOAD_IMAGE_SIZE } from '../utils/uploadImageCrop';

export function useProfileIdentityEdit() {
    const { t } = useTranslation();
    const { updateUser } = useAuthStore();
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [isEditNicknameOpen, setIsEditNicknameOpen] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const openEditNickname = useCallback(() => {
        setIsEditNicknameOpen(true);
    }, []);

    const closeEditNickname = useCallback(() => {
        setIsEditNicknameOpen(false);
    }, []);

    const openAvatarPicker = useCallback(() => {
        if (isUploadingAvatar) return;
        avatarInputRef.current?.click();
    }, [isUploadingAvatar]);

    const handleAvatarFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error(t('profile.selectImageFile'));
            return;
        }
        if (file.size > MAX_UPLOAD_IMAGE_SIZE) {
            toast.error(t('profile.imageTooLarge'));
            return;
        }

        setIsUploadingAvatar(true);
        try {
            const response = await auth.updateUserAvatar(file);
            if (!response.data.success || !response.data.data?.avatarUrl) {
                throw new Error(response.data.message || t('common.error'));
            }
            updateUser({ avatarUrl: response.data.data.avatarUrl });
            toast.success(t('profile.avatarUpdated'));
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setIsUploadingAvatar(false);
        }
    }, [t, updateUser]);

    const identityEditModal = (
        <EditNicknameModal
            isOpen={isEditNicknameOpen}
            onClose={closeEditNickname}
        />
    );

    return {
        isUploadingAvatar,
        avatarInputRef,
        openAvatarPicker,
        handleAvatarFileChange,
        openEditNickname,
        identityEditModal,
    };
}
