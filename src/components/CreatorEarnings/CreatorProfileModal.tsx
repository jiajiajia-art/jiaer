import React from 'react';
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

const CreatorProfileModal: React.FC<Props> = ({ open, data, loading, error, onRetry, onSave, onClose }) => (
    <CreatorEarningsModalShell open={open} title="创作者资料" onClose={onClose} wide>
        {loading && <div>正在加载创作者资料…</div>}
        {error && <div role="alert">资料加载失败 <button type="button" onClick={onRetry}>重试</button></div>}
        {!loading && !error && <CreatorProfile data={data} onSave={onSave} />}
    </CreatorEarningsModalShell>
);

export default CreatorProfileModal;
