import React, { useState } from 'react';
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

export interface CreatorProfileData {
    groupNo?: string;
    realName?: string;
    idCard?: string;
    bankCard?: string;
    bankBranch?: string;
}

export interface CreatorProfileFormData {
    groupNo: string;
    realName: string;
    idCard: string;
    bankCard: string;
    bankBranch: string;
}

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
    label: string;
    value?: string;
    masked?: string;
    isSecret?: boolean;
    onCopy?: () => void;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, masked, isSecret, onCopy }) => {
    const [showSecret, setShowSecret] = useState(false);
    const displayValue = value || '未填写';
    const showValue = isSecret && masked && !showSecret ? masked : displayValue;

    return (
        <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{label}</span>
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
                            title={showSecret ? '隐藏' : '显示'}
                        >
                            {showSecret ? <MdVisibilityOff /> : <MdVisibility />}
                        </button>
                    )}
                    {onCopy && (
                        <button type="button" className={styles.infoActionBtn} onClick={onCopy} title="复制">
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
    const [formData, setFormData] = useState<CreatorProfileFormData>({
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

        if (formData.groupNo && !/^\d{5,11}$/.test(formData.groupNo)) {
            newErrors.groupNo = 'QQ群号需为 5-11 位数字';
        }

        if (
            formData.idCard &&
            !/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(formData.idCard)
        ) {
            newErrors.idCard = '身份证号格式不正确';
        }

        if (formData.bankCard && !/^\d{16,19}$/.test(formData.bankCard)) {
            newErrors.bankCard = '银行卡号需为 16-19 位数字';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setIsSaving(true);
            await onSave(formData);
            toast.success('创作者资料保存成功');
        } catch {
            toast.error('保存失败，请稍后重试');
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

    const inputClass = (field: keyof CreatorProfileFormData) =>
        `${styles.formInput} ${errors[field] ? styles.formInputError : ''}`;

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>
                    <MdGroups />
                    <span>社群信息</span>
                </div>
                <div className={styles.formField}>
                    <label className={styles.formLabel}>QQ群号</label>
                    <input
                        type="text"
                        className={inputClass('groupNo')}
                        placeholder="请输入QQ群号（5-11位数字）"
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
                    <span>收款信息</span>
                </div>
                <div className={styles.formField}>
                    <label className={styles.formLabel}>真实姓名</label>
                    <input
                        type="text"
                        className={inputClass('realName')}
                        placeholder="请输入真实姓名"
                        value={formData.realName}
                        onChange={(e) => handleChange('realName', e.target.value)}
                        maxLength={50}
                    />
                    {errors.realName && <span className={styles.formError}>{errors.realName}</span>}
                </div>
                <div className={styles.formField}>
                    <label className={styles.formLabel}>身份证号</label>
                    <input
                        type="text"
                        className={inputClass('idCard')}
                        placeholder="请输入18位身份证号"
                        value={formData.idCard}
                        onChange={(e) => handleChange('idCard', e.target.value.toUpperCase())}
                        maxLength={18}
                    />
                    {errors.idCard && <span className={styles.formError}>{errors.idCard}</span>}
                </div>
                <div className={styles.formField}>
                    <label className={styles.formLabel}>银行卡号</label>
                    <input
                        type="text"
                        className={inputClass('bankCard')}
                        placeholder="请输入银行卡号（16-19位）"
                        value={formData.bankCard}
                        onChange={(e) => handleChange('bankCard', e.target.value.replace(/\D/g, ''))}
                        maxLength={19}
                    />
                    {errors.bankCard && <span className={styles.formError}>{errors.bankCard}</span>}
                </div>
                <div className={styles.formField}>
                    <label className={styles.formLabel}>开户银行</label>
                    <input
                        type="text"
                        className={inputClass('bankBranch')}
                        placeholder="如：中国工商银行北京中关村支行"
                        value={formData.bankBranch}
                        onChange={(e) => handleChange('bankBranch', e.target.value)}
                        maxLength={100}
                    />
                    {errors.bankBranch && <span className={styles.formError}>{errors.bankBranch}</span>}
                </div>
            </div>

            <div className={styles.securityNotice}>
                <span className={styles.securityIcon}>🔒</span>
                <span>您的敏感信息已加密存储，仅用于提现验证</span>
            </div>

            <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={isSaving}>
                    取消
                </button>
                <button type="submit" className={styles.saveBtn} disabled={isSaving}>
                    {isSaving ? '保存中...' : '保存'}
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
    const handleCopyGroupNo = async () => {
        if (data.groupNo) {
            try {
                await navigator.clipboard.writeText(data.groupNo);
                toast.success('QQ群号已复制');
            } catch {
                toast.error('复制失败');
            }
        }
    };

    const hasAnyData = data.groupNo || data.realName || data.idCard || data.bankCard || data.bankBranch;
    const hasPayoutData = data.realName || data.idCard || data.bankCard || data.bankBranch;

    return (
        <div className={styles.viewContainer}>
            <SectionCard title="社群信息" icon={<MdGroups />} isEmpty={!data.groupNo}>
                {data.groupNo ? (
                    <InfoRow label="QQ群号" value={data.groupNo} onCopy={handleCopyGroupNo} />
                ) : (
                    <div className={styles.emptyState}>
                        <span>暂未填写 QQ 群号</span>
                    </div>
                )}
            </SectionCard>

            <SectionCard title="收款信息" icon={<MdAccountBalanceWallet />} isEmpty={!hasPayoutData}>
                {hasPayoutData ? (
                    <>
                        <InfoRow label="真实姓名" value={data.realName || '未填写'} />
                        <InfoRow
                            label="身份证号"
                            value={data.idCard || '未填写'}
                            masked={data.idCard ? maskIdCard(data.idCard) : undefined}
                            isSecret
                        />
                        <InfoRow
                            label="银行卡号"
                            value={data.bankCard || '未填写'}
                            masked={data.bankCard ? maskBankCard(data.bankCard) : undefined}
                            isSecret
                        />
                        <InfoRow label="开户银行" value={data.bankBranch || '未填写'} />
                    </>
                ) : (
                    <div className={styles.emptyState}>
                        <span>暂未填写任何收款信息</span>
                    </div>
                )}
            </SectionCard>

            <div className={styles.editButtonWrapper}>
                <button type="button" className={styles.editButton} onClick={onEdit}>
                    <MdEdit />
                    <span>{hasAnyData ? '编辑信息' : '填写信息'}</span>
                </button>
            </div>

            {hasAnyData && (
                <div className={styles.securityNotice}>
                    <span className={styles.securityIcon}>🔒</span>
                    <span>您的敏感信息已加密存储，仅用于提现验证</span>
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
