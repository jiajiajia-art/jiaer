import React, { useState, useRef } from 'react';
import styles from './FunctionalNPCsPanel.module.css';
import { toast } from 'react-hot-toast';
import type { FunctionalNPC, FunctionalNPCOption } from './types';

interface FunctionalNPCDetailProps {
    npc: FunctionalNPC | null;
    isNew: boolean;
    onSave: (updatedNPC: FunctionalNPC) => void;
}

const FunctionalNPCDetail: React.FC<FunctionalNPCDetailProps> = ({
    npc,
    isNew,
    onSave,
}) => {
    const [formData, setFormData] = useState<Partial<FunctionalNPC>>({
        name: '',
        type: 'portrait',
        image: '',
        hasOptions: false,
        description: '',
        buttonText: '',
        options: [],
    });
    const [isSaving, setIsSaving] = useState(false);
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
                description: npc.description || '',
                buttonText: npc.buttonText || '',
                options: npc.options || [],
            });
        } else {
            setFormData({
                name: '',
                type: 'portrait',
                image: '',
                hasOptions: false,
                description: '',
                buttonText: '',
                options: [],
            });
        }
    }, [npc]);

    const handleFieldChange = (field: keyof FunctionalNPC, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddOption = () => {
        const newOption: FunctionalNPCOption = {
            id: `opt-${Date.now()}`,
            name: '',
            description: '',
        };
        setFormData(prev => ({
            ...prev,
            options: [...(prev.options || []), newOption],
        }));
    };

    const handleRemoveOption = (optionId: string) => {
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

    const handleSave = () => {
        if (!npc) return;

        // 验证必填字段
        if (!formData.name?.trim()) {
            toast.error('请输入NPC名称');
            return;
        }

        if (!formData.image) {
            toast.error('请上传立绘图');
            return;
        }

        if (!formData.description?.trim()) {
            toast.error('请输入说明');
            return;
        }

        // 如果选中了"点击后出现选项"，验证选项列表
        if (formData.hasOptions) {
            if (!formData.options || formData.options.length === 0) {
                toast.error('至少需要添加一个选项');
                return;
            }
            // 验证选项必填
            for (const option of formData.options) {
                if (!option.name?.trim() || !option.description?.trim()) {
                    toast.error('请填写完整的选项信息');
                    return;
                }
            }
        }

        setIsSaving(true);
        
        // 构建更新后的NPC数据
        const updatedNPC: FunctionalNPC = {
            id: npc.id,
            name: formData.name!,
            type: formData.type!,
            image: formData.image,
            hasOptions: formData.hasOptions!,
            description: formData.description,
            options: formData.hasOptions ? (formData.options || []) : [],
        };

        // 通过回调更新父组件状态
        onSave(updatedNPC);
        setIsSaving(false);
    };

    if (!npc) {
        return (
            <div className={styles.npcDetail}>
                <div className={styles.emptyDetail}>
                    <p>请选择一个功能性NPC进行编辑</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.npcDetail}>
            {/* 顶部：类型切换（仅新建时显示） + 确认按钮 */}
            <div className={styles.detailHeaderRow}>
                {isNew && (
                    <div className={styles.typeSwitchRow}>
                        <span className={styles.typeLabel}>类型</span>
                        <div className={styles.npcTypeToggle}>
                            <button
                                type="button"
                                className={`${styles.npcTypeToggleButton} ${
                                    formData.type === 'portrait' ? styles.npcTypeToggleButtonActive : ''
                                }`}
                                onClick={() => handleFieldChange('type', 'portrait')}
                            >
                                立绘型
                            </button>
                            <button
                                type="button"
                                className={`${styles.npcTypeToggleButton} ${
                                    formData.type === 'button' ? styles.npcTypeToggleButtonActive : ''
                                }`}
                                onClick={() => handleFieldChange('type', 'button')}
                            >
                                按钮型
                            </button>
                        </div>
                    </div>
                )}
                <div className={styles.formActionsTop}>
                    <button
                        type="button"
                        className={styles.primary}
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? '保存中...' : '确认修改'}
                    </button>
                </div>
            </div>

            <div className={styles.detailForm}>
                {/* 左侧：立绘显示 */}
                <div className={styles.imageSection}>
                    <div className={styles.imagePreview}>
                        <img
                            src={formData.image || DEFAULT_NPC_IMAGE}
                            alt="NPC预览"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = DEFAULT_NPC_IMAGE;
                            }}
                        />
                    </div>
                    <div className={styles.imageUploadActions}>
                        <button
                            type="button"
                            className={styles.ghostSmall}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            上传图片
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                        {/* TODO: 添加AI生图功能 */}
                    </div>
                </div>

                {/* 右侧：表单 */}
                <div className={styles.formSection}>

                    <div className={styles.formGroup}>
                        <label>
                            <span>名称 <span className={styles.required}>*</span></span>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleFieldChange('name', e.target.value)}
                                placeholder="输入NPC名称"
                            />
                        </label>
                    </div>

                    {/* 说明 */}
                    <div className={styles.formGroup}>
                        <label>
                            <span>说明 <span className={styles.required}>*</span></span>
                            <textarea
                                rows={4}
                                value={formData.description || ''}
                                onChange={(e) => handleFieldChange('description', e.target.value)}
                                placeholder="输入NPC说明"
                            />
                        </label>
                    </div>

                    {/* 点击后出现选项复选框 */}
                    <div className={styles.formGroup}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={formData.hasOptions}
                                onChange={(e) => handleFieldChange('hasOptions', e.target.checked)}
                            />
                            <span>点击后出现选项</span>
                        </label>
                    </div>

                    {/* 当复选框选中时，显示选项列表 */}
                    {formData.hasOptions && (
                        <div className={styles.formGroup}>
                            <div className={styles.optionsHeader}>
                                <span>选项列表</span>
                                <button
                                    type="button"
                                    className={styles.ghostSmall}
                                    onClick={handleAddOption}
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
                                                    <span>选项名称</span>
                                                    <input
                                                        type="text"
                                                        value={option.name}
                                                        onChange={(e) => handleOptionChange(option.id, 'name', e.target.value)}
                                                        placeholder="游戏端展示的选项内容"
                                                    />
                                                </label>
                                                <label>
                                                    <span>描述</span>
                                                    <textarea
                                                        rows={2}
                                                        value={option.description}
                                                        onChange={(e) => handleOptionChange(option.id, 'description', e.target.value)}
                                                        placeholder="选项详情描述"
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
                    )}

                </div>
            </div>
        </div>
    );
};

export default FunctionalNPCDetail;

