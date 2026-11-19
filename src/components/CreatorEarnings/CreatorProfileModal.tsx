import React from 'react';
import { useTranslation } from 'react-i18next';
import CreatorProfile, { type CreatorProfileData, type CreatorProfileFormData } from '../CreatorProfile';
import CreatorEarningsModalShell from './CreatorEarningsModalShell';

interface Props {
    open: boolean;
    data: CreatorProfileData;
    loading: boolean;
    error: boolean;
    onRetry: () => void;
    onSave: (data: CreatorProfileFormData) => Promise<void>;
    onClose: () => void;
}

const CreatorProfileModal: React.FC<Props> = ({ open, data, loading, error, onRetry, onSave, onClose }) => {
    const { t } = useTranslation();
    return (
    <CreatorEarningsModalShell open={open} title={t('creatorCenter.profile')} onClose={onClose} wide>
        {loading && <div>{t('creatorCenter.profileLoading')}</div>}
        {error && <div role="alert">{t('creatorCenter.profileLoadFailed')} <button type="button" onClick={onRetry}>{t('common.retry')}</button></div>}
        {!loading && !error && <CreatorProfile data={data} onSave={onSave} />}
    </CreatorEarningsModalShell>
    );
};

export default CreatorProfileModal;
