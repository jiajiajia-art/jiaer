import React, { useState, useRef } from 'react';
import styles from './FunctionalNPCDetail.module.css';
import sharedStyles from './shared.module.css';
import { toast } from 'react-hot-toast';
import type { FunctionalNPC, FunctionalNPCOption } from './types';
import { getImageUrl } from '../../../utils/constants';

interface FunctionalNPCDetailProps {
    npc: FunctionalNPC | null;
    onSave: (updatedNPC: FunctionalNPC) => void;
}

const FunctionalNPCDetail: React.FC<FunctionalNPCDetailProps> = ({
    npc,
    onSave,
}) => {
    const [formData, setFormData] = useState<Partial<FunctionalNPC>>({
        name: '',
        type: 'portrait',
        image: '',
        hasOptions: false,
        buttonText: '',
        options: [],
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSelectOpen, setIsSelectOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const DEFAULT_NPC_IMAGE = '';

    // 当npc变化时，更新表单数据
    React.useEffect(() => {
        if (npc) {
            setFormData({
                name: npc.name || '',
                type: npc.type || 'portrait',
                image: npc.image || '',
                hasOptions: npc.hasOptions || false,
                buttonText: npc.buttonText || '',
                options: npc.options && npc.options.length > 0 ? npc.options : [{ id: `opt-${Date.now()}`, name: '', description: '' }],
            });
        } else {
            setFormData({
                name: '',
                type: 'portrait',
                image: '',
                hasOptions: false,
                buttonText: '',
                options: [{ id: `opt-${Date.now()}`, name: '', description: '' }],
            });
        }
    }, [npc]);

    const handleFieldChange = (field: keyof FunctionalNPC, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddOption = () => {
        const currentOptions = formData.options || [];
        if (currentOptions.length >= 5) {
            toast.error('最多只能添加5个选项');
            return;
        }
        const newOption: FunctionalNPCOption = {
            id: `opt-${Date.now()}`,
            name: '',
            description: '', // 选项的描述字段保留
        };
        setFormData(prev => ({
            ...prev,
            options: [...(prev.options || []), newOption],
        }));
    };

    const handleRemoveOption = (optionId: string) => {
        const currentOptions = formData.options || [];
        if (currentOptions.length <= 1) {
            toast.error('至少需要保留1个选项');
            return;
        }
        setFormData(prev => ({
            ...prev,
            options: (prev.options || []).filter(opt => opt.id !== optionId),
        }));
    };

    const handleOptionChange = (optionId: string, field: 'name' | 'description', value: string) => {
        setFormData(prev => ({
            ...prev,
            options: (prev.options || []).map(opt =>
                opt.id === optionId ? { ...opt, [field]: value } : opt
            ),
        }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast.error('请选择图片文件');
                return;
            }

            // 创建本地预览URL
            const imageUrl = URL.createObjectURL(file);
            setFormData(prev => ({ ...prev, image: imageUrl }));
            toast.success('图片已选择');
        }
    };

    const handleGenerateImage = async () => {
        // TODO: 实现图片生成逻辑
        setIsGenerating(true);
        try {
            // 模拟生成过程
            await new Promise(resolve => setTimeout(resolve, 2000));
            toast.success('图片生成成功');
            // setFormData(prev => ({ ...prev, image: 'generated-image-url' }));
        } catch (error) {
            toast.error('图片生成失败');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = () => {
        // 验证必填字段
        if (!formData.name?.trim()) {
            toast.error('请输入NPC名称');
            return;
        }

        // 立绘型需要验证图片
        if (formData.type === 'portrait' && !formData.image) {
            toast.error('请上传或生成立绘图');
            return;
        }

        // 按钮型需要验证按钮文字
        if (formData.type === 'button' && !formData.buttonText?.trim()) {
            toast.error('请输入按钮文字');
            return;
        }

        if (!formData.options || formData.options.length === 0) {
            toast.error('至少需要添加1个选项');
            return;
        }
        if (formData.options.length > 5) {
            toast.error('最多只能添加5个选项');
            return;
        }
        for (const option of formData.options) {
            if (!option.name?.trim()) {
                toast.error('请填写完整的选项信息');
                return;
            }
        }

        setIsSaving(true);

        const updatedNPC: FunctionalNPC = {
            id: npc?.id || `npc-${Date.now()}`,
            name: formData.name!,
            type: formData.type!,
            image: formData.image || '',
            buttonText: formData.buttonText || '',
            hasOptions: (formData.options && formData.options.length > 0) || false,
            options: formData.options || [],
        };

        // 通过回调更新父组件状态
        onSave(updatedNPC);
        setIsSaving(false);
    };

    return (
        <div className={styles.npcDetail}>
            <div className={styles.typeSwitchRow}>
                <label>
                    <span className={styles.typeLabel}>NPC类型 <span className={sharedStyles.required}>*</span></span>
                    <div className={styles.typeSelectWrapper}>
                        <select
                            value={formData.type}
                            onChange={(e) => {
                                handleFieldChange('type', e.target.value as 'portrait' | 'button');
                                requestAnimationFrame(() => {
                                    setIsSelectOpen(false);
                                });
                            }}
                            onMouseDown={() => {
                                setIsSelectOpen((prev) => !prev);
                            }}
                            onBlur={() => {
                                requestAnimationFrame(() => {
                                    setIsSelectOpen(false);
                                });
                            }}
                            className={styles.typeSelect}
                        >
                            <option value="portrait">立绘型</option>
                            <option value="button">按钮型</option>
                        </select>
                        <span className={`${styles.typeSelectArrow} ${isSelectOpen ? styles.typeSelectArrowOpen : ''}`}></span>
                    </div>
                </label>
            </div>

            <div className={styles.detailForm}>
                <div className={styles.formSection}>
                    <div className={styles.formGroup}>
                        <label>
                            <span>NPC名称 <span className={sharedStyles.required}>*</span></span>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleFieldChange('name', e.target.value)}
                                placeholder="输入NPC名称"
                            />
                        </label>
                    </div>

                    {formData.type === 'portrait' && (
                        <div className={styles.formGroup}>
                            <label>
                                <span>立绘图 <span className={sharedStyles.required}>*</span></span>
                                <div className={styles.imageUploadArea}>
                                    {formData.image ? (
                                        <div className={styles.imagePreview}>
                                            <img
                                                src={formData.image.startsWith('blob:') ? formData.image : getImageUrl(formData.image)}
                                                alt="NPC预览"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = DEFAULT_NPC_IMAGE;
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className={styles.imagePlaceholder}>
                                            <span>暂无图片</span>
                                        </div>
                                    )}
                                    <div className={styles.imageUploadActions}>
                                        <button
                                            type="button"
                                            className={sharedStyles.ghostSmall}
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            上传图片
                                        </button>
                                        <button
                                            type="button"
                                            className={sharedStyles.ghostSmall}
                                            onClick={handleGenerateImage}
                                            disabled={isGenerating}
                                        >
                                            {isGenerating ? '生成中...' : 'AI生成'}
                                        </button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            style={{ display: 'none' }}
                                        />
                                    </div>
                                </div>
                            </label>
                        </div>
                    )}

                    {formData.type === 'button' && (
                        <div className={styles.formGroup}>
                            <label>
                                <span>按钮文字 <span className={sharedStyles.required}>*</span></span>
                                <input
                                    type="text"
                                    value={formData.buttonText || ''}
                                    onChange={(e) => handleFieldChange('buttonText', e.target.value)}
                                    placeholder="输入按钮显示的文字"
                                />
                            </label>
                        </div>
                    )}

                    <div className={styles.formGroup}>
                        <div className={styles.optionsHeader}>
                            <span>选项列表 <span className={sharedStyles.required}>*</span>（最少1个，最多5个）</span>
                            <button
                                type="button"
                                className={sharedStyles.ghostSmall}
                                onClick={handleAddOption}
                                disabled={(formData.options || []).length >= 5}
                            >
                                + 新增选项
                            </button>
                        </div>
                        <div className={styles.optionsList}>
                            {formData.options && formData.options.length > 0 ? (
                                formData.options.map((option) => (
                                    <div key={option.id} className={styles.optionItem}>
                                        <div className={styles.optionHeader}>
                                            <span>选项 {formData.options!.indexOf(option) + 1}</span>
                                            <button
                                                type="button"
                                                className={styles.deleteButton}
                                                onClick={() => handleRemoveOption(option.id)}
                                            >
                                                删除
                                            </button>
                                        </div>
                                        <div className={styles.optionFields}>
                                            <label>
                                                <span>选项名称 <span className={sharedStyles.required}>*</span></span>
                                                <input
                                                    type="text"
                                                    value={option.name}
                                                    onChange={(e) => handleOptionChange(option.id, 'name', e.target.value)}
                                                    placeholder="游戏端展示的选项内容"
                                                />
                                            </label>
                                            <label>
                                                <span>描述 <span className={sharedStyles.required}>*</span></span>
                                                <textarea
                                                    rows={2}
                                                    value={option.description}
                                                    onChange={(e) => handleOptionChange(option.id, 'description', e.target.value)}
                                                    placeholder="给大模型用的提示词"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className={styles.emptyOptions}>
                                    <p>暂无选项，点击"新增选项"添加</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.formActionsBottom}>
                        <button
                            type="button"
                            className={sharedStyles.primary}
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? '保存中...' : '确认修改'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FunctionalNPCDetail;

