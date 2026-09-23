import React from 'react';
import ProfilePreferenceModal from './ProfilePreferenceModal';
import { useAuthStore } from '../store/useAuthStore';
import { isUserProfileComplete } from '../utils/profileCompletion';

const ProfilePreferenceGate: React.FC = () => {
    const { isAuthenticated, user } = useAuthStore();
    const currentUser = user?.user;
    const shouldBlock = Boolean(isAuthenticated && currentUser && !isUserProfileComplete(currentUser));

    return (
        <ProfilePreferenceModal
            isOpen={shouldBlock}
            required
        />
    );
};

export default ProfilePreferenceGate;
