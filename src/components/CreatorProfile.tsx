import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './CreatorProfile.module.css';
import {
    MdGroups,
    MdAccountBalanceWallet,
    MdEdit,
    MdContentCopy,
    MdVisibility,
    MdVisibilityOff,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';

export interface CreatorProfileData {
    phoneNumber?: string;
    groupNo?: string;
    realName?: string;
    idCard?: string;
    bankCard?: string;
    bankBranch?: string;
}

export interface CreatorProfileFormData {
    phoneNumber: string;
    groupNo: string;
    realName: string;
    idCard: string;
    bankCard: string;
    bankBranch: string;
}

const CN_PHONE_RE = /^1[3-9]\d{9}$/;

const maskString = (str: string, visibleStart = 3, visibleEnd = 1): string => {
    if (!str || str.length <= visibleStart + visibleEnd) return str;
    const start = str.slice(0, visibleStart);
    const end = str.slice(-visibleEnd);
    const masked = '*'.repeat(Math.min(str.length - visibleStart - visibleEnd, 8));
    return `${start}${masked}${end}`;
};

const maskIdCard = (idCard: string): string => {
    if (!idCard) return '';
    if (idCard.length >= 10) {
        return `${idCard.slice(0, 3)}**********${idCard.slice(-4)}`;
    }
    return maskString(idCard);
};

const maskBankCard = (card: string): string => {
    if (!card) return '';
    if (card.length >= 8) {
        return `**** **** **** ${card.slice(-4)}`;
    }
    return maskString(card);
};

const maskPhone = (phone: string): string => {
    if (!phone || phone.length < 7) return phone || '';
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
};

interface SectionCardProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    isEmpty?: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, icon, children, isEmpty }) => {
    return (
        <div className={`${styles.sectionCard} ${isEmpty ? styles.sectionCardEmpty : ''}`}>
            <div className={styles.sectionHeader}>
                <div className={styles.sectionIcon}>{icon}</div>
                <h3 className={styles.sectionTitle}>{title}</h3>
            </div>
            <div className={styles.sectionContent}>{children}</div>
        </div>
    );
};

interface InfoRowProps {
    labelKey?: string;
    label?: string;
    value?: string;
    masked?: string;
    isSecret?: boolean;
    onCopy?: () => void;
}

const InfoRow: React.FC<InfoRowProps> = ({ labelKey, label, value, masked, isSecret, onCopy }) => {
    const { t } = useTranslation();
    const [showSecret, setShowSecret] = useState(false);
    const displayValue = value || t('profile.notFilled');
    const showValue = isSecret && masked && !showSecret ? masked : displayValue;
    const displayLabel = labelKey ? t(labelKey) : label;

    return (
        <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{displayLabel}</span>
            <div className={styles.infoValueWrapper}>
                <span className={isSecret && masked && !showSecret ? styles.infoValueMasked : styles.infoValue}>
                    {showValue}
                </span>
                <div className={styles.infoActions}>
                    {isSecret && masked && (
                        <button
                            type="button"
                            className={styles.infoActionBtn}
                            onClick={() => setShowSecret(!showSecret)}
                            title={showSecret ? t('password.hide') : t('password.show')}
                        >
                            {showSecret ? <MdVisibilityOff /> : <MdVisibility />}
                        </button>
                    )}
                    {onCopy && (
                        <button type="button" className={styles.infoActionBtn} onClick={onCopy} title={t('profile.copy')}>
                            <MdContentCopy />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

interface CreatorProfileFormProps {
    initialData: CreatorProfileData;
    onSave: (data: CreatorProfileFormData) => Promise<void>;
    onCancel: () => void;
}

const CreatorProfileForm: React.FC<CreatorProfileFormProps> = ({ initialData, onSave, onCancel }) => {
    const { t } = useTranslation();
    const storePhone = String(useAuthStore((s) => s.user?.user?.phoneNumber) || '').trim();
    const lockedPhone = String(initialData.phoneNumber || storePhone || '').trim();
    const phoneLocked = Boolean(lockedPhone);

    const [formData, setFormData] = useState<CreatorProfileFormData>({
        phoneNumber: lockedPhone,
        groupNo: initialData.groupNo || '',
        realName: initialData.realName || '',
        idCard: initialData.idCard || '',
        bankCard: initialData.bankCard || '',
        bankBranch: initialData.bankBranch || '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof CreatorProfileFormData, string>>>({});

    const validateForm = (): boolean => {
        const newErrors: Partial<Record<keyof CreatorProfileFormData, string>> = {};

        if (!phoneLocked) {
            const phone = formData.phoneNumber.trim();
            if (!phone) {
                newErrors.phoneNumber = t('profile.phoneRequired');
            } else if (!CN_PHONE_RE.test(phone)) {
                newErrors.phoneNumber = t('profile.phoneInvalid');
            }
        }

        if (formData.groupNo && !/^\d{5,11}$/.test(formData.groupNo)) {
            newErrors.groupNo = t('profile.groupNoError');
        }

        if (
            formData.idCard &&
            !/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(formData.idCard)
        ) {
            newErrors.idCard = t('profile.idCardError');
        }

        if (formData.bankCard && !/^\d{16,19}$/.test(formData.bankCard)) {
            newErrors.bankCard = t('profile.bankCardError');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setIsSaving(true);
            const payload: CreatorProfileFormData = {
                ...formData,
                phoneNumber: phoneLocked ? lockedPhone : formData.phoneNumber.trim(),
            };
            await onSave(payload);
            toast.success(t('profile.saveSuccess'));
        } catch {
            toast.error(t('profile.saveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (field: keyof CreatorProfileFormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
    };

    const inputClass = (field: keyof CreatorProfileFormData, extra?: string) =>
        `${styles.formInput} ${errors[field] ? styles.formInputError : ''} ${extra || ''}`.trim();

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>
                    <MdGroups />
                    <span>{t('profile.communityInfo')}</span>
                </div>
                <div className={styles.formField}>
                    <label className={styles.formLabel}>{t('createGame.qqGroup')}</label>
                    <input
                        type="text"
                        className={inputClass('groupNo')}
                        placeholder={t('createGame.qqGroupPlaceholder') || '请输入QQ群号（5-11位数字）'}
                        value={formData.groupNo}
                        onChange={(e) => handleChange('groupNo', e.target.value.replace(/\D/g, ''))}
                        maxLength={11}
                    />
                    {errors.groupNo && <span className={styles.formError}>{errors.groupNo}</span>}
                </div>
            </div>

            <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>
                    <MdAccountBalanceWallet />
                    <span>{t('profile.paymentInfo')}</span>
                </div>
                <div className={styles.formField}>
                    <label className={styles.formLabel}>{t('profile.phone')}</label>
                    <input
                        type="text"
                        className={inputClass('phoneNumber', phoneLocked ? styles.formInputReadonly : '')}
                        placeholder={t('profile.phonePlaceholder')}
                        value={phoneLocked ? maskPhone(lockedPhone) : formData.phoneNumber}
                        onChange={(e) => {
                            if (phoneLocked) return;
                            handleChange('phoneNumber', e.target.value.replace(/\D/g, '').slice(0, 11));
                        }}
                        readOnly={phoneLocked}
                        maxLength={11}
                        inputMode="numeric"
                        autoComplete="tel"
                    />
                    {phoneLocked ? (
                        <span className={styles.formHint}>{t('profile.phoneBoundHint')}</span>
                    ) : (
                        errors.phoneNumber && <span className={styles.formError}>{errors.phoneNumber}</span>
                    )}
                </div>
                <div className={styles.formField}>
                    <label className={styles.formLabel}>{t('profile.realName')}</label>
                    <input
                        type="text"
                        className={inputClass('realName')}
                        placeholder={t('profile.realNamePlaceholder')}
                        value={formData.realName}
                        onChange={(e) => handleChange('realName', e.target.value)}
                        maxLength={50}
                    />
                    {errors.realName && <span className={styles.formError}>{errors.realName}</span>}
                </div>
                <div className={styles.formField}>
                    <label className={styles.formLabel}>{t('profile.idCardNo')}</label>
                    <input
                        type="text"
                        className={inputClass('idCard')}
                        placeholder={t('profile.idCardPlaceholder')}
                        value={formData.idCard}
                        onChange={(e) => handleChange('idCard', e.target.value.toUpperCase())}
                        maxLength={18}
                    />
                    {errors.idCard && <span className={styles.formError}>{errors.idCard}</span>}
                </div>
                <div className={styles.formField}>
                    <label className={styles.formLabel}>{t('profile.bankCardNo')}</label>
                    <input
                        type="text"
                        className={inputClass('bankCard')}
                        placeholder={t('profile.bankCardPlaceholder')}
                        value={formData.bankCard}
                        onChange={(e) => handleChange('bankCard', e.target.value.replace(/\D/g, ''))}
                        maxLength={19}
                    />
                    {errors.bankCard && <span className={styles.formError}>{errors.bankCard}</span>}
                </div>
                <div className={styles.formField}>
                    <label className={styles.formLabel}>{t('profile.bankName')}</label>
                    <input
                        type="text"
                        className={inputClass('bankBranch')}
                        placeholder={t('profile.bankBranchPlaceholder')}
                        value={formData.bankBranch}
                        onChange={(e) => handleChange('bankBranch', e.target.value)}
                        maxLength={100}
                    />
                    {errors.bankBranch && <span className={styles.formError}>{errors.bankBranch}</span>}
                </div>
            </div>

            <div className={styles.securityNotice}>
                <span className={styles.securityIcon}>🔒</span>
                <span>{t('profile.securityNotice')}</span>
            </div>

            <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={isSaving}>
                    {t('profile.cancel')}
                </button>
                <button type="submit" className={styles.saveBtn} disabled={isSaving}>
                    {isSaving ? t('profile.saving') : t('profile.save')}
                </button>
            </div>
        </form>
    );
};

interface CreatorProfileViewProps {
    data: CreatorProfileData;
    onEdit: () => void;
}

const CreatorProfileView: React.FC<CreatorProfileViewProps> = ({ data, onEdit }) => {
    const { t } = useTranslation();
    const storePhone = String(useAuthStore((s) => s.user?.user?.phoneNumber) || '').trim();
    const phoneNumber = String(data.phoneNumber || storePhone || '').trim();

    const handleCopyGroupNo = async () => {
        if (data.groupNo) {
            try {
                await navigator.clipboard.writeText(data.groupNo);
                toast.success(t('createGame.qqGroupCopied'));
            } catch {
                toast.error(t('profile.copyFailed'));
            }
        }
    };

    const hasAnyData = phoneNumber || data.groupNo || data.realName || data.idCard || data.bankCard || data.bankBranch;
    const hasPayoutData = phoneNumber || data.realName || data.idCard || data.bankCard || data.bankBranch;

    return (
        <div className={styles.viewContainer}>
            <SectionCard title={t('profile.communityInfo')} icon={<MdGroups />} isEmpty={!data.groupNo}>
                {data.groupNo ? (
                    <InfoRow labelKey="profile.qqGroupNo" value={data.groupNo} onCopy={handleCopyGroupNo} />
                ) : (
                    <div className={styles.emptyState}>
                        <span>{t('profile.noGroupNoYet')}</span>
                    </div>
                )}
            </SectionCard>

            <SectionCard title={t('profile.paymentInfo')} icon={<MdAccountBalanceWallet />} isEmpty={!hasPayoutData}>
                {hasPayoutData ? (
                    <>
                        <InfoRow
                            labelKey="profile.phone"
                            value={phoneNumber || t('profile.notFilled')}
                            masked={phoneNumber ? maskPhone(phoneNumber) : undefined}
                            isSecret={Boolean(phoneNumber)}
                        />
                        <InfoRow labelKey="profile.realName" value={data.realName || t('profile.notFilled')} />
                        <InfoRow
                            labelKey="profile.idCardNo"
                            value={data.idCard || t('profile.notFilled')}
                            masked={data.idCard ? maskIdCard(data.idCard) : undefined}
                            isSecret
                        />
                        <InfoRow
                            labelKey="profile.bankCardNo"
                            value={data.bankCard || t('profile.notFilled')}
                            masked={data.bankCard ? maskBankCard(data.bankCard) : undefined}
                            isSecret
                        />
                        <InfoRow labelKey="profile.bankName" value={data.bankBranch || t('profile.notFilled')} />
                    </>
                ) : (
                    <div className={styles.emptyState}>
                        <span>{t('profile.noPaymentInfoYet')}</span>
                    </div>
                )}
            </SectionCard>

            <div className={styles.editButtonWrapper}>
                <button type="button" className={styles.editButton} onClick={onEdit}>
                    <MdEdit />
                    <span>{hasAnyData ? t('profile.editInfo') : t('profile.fillInfo')}</span>
                </button>
            </div>

            {hasAnyData && (
                <div className={styles.securityNotice}>
                    <span className={styles.securityIcon}>🔒</span>
                    <span>{t('profile.securityNotice')}</span>
                </div>
            )}
        </div>
    );
};

interface CreatorProfileProps {
    data: CreatorProfileData;
    onSave: (data: CreatorProfileFormData) => Promise<void>;
}

const CreatorProfile: React.FC<CreatorProfileProps> = ({ data, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [viewData, setViewData] = useState(data);

    React.useEffect(() => {
        setViewData(data);
    }, [data]);

    const handleSave = async (formData: CreatorProfileFormData) => {
        await onSave(formData);
        setViewData(formData);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
    };

    return (
        <div className={styles.creatorProfile}>
            {isEditing ? (
                <CreatorProfileForm initialData={viewData} onSave={handleSave} onCancel={handleCancel} />
            ) : (
                <CreatorProfileView data={viewData} onEdit={() => setIsEditing(true)} />
            )}
        </div>
    );
};

export default CreatorProfile;
