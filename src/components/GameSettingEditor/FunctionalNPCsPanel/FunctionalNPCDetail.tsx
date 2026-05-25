import React, { useState, useRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './FunctionalNPCDetail.module.css';
import sharedStyles from './shared.module.css';
import ConfirmModal from '../../CommonModal/ConfirmModal';
import { toast } from 'react-hot-toast';
import type { AbilityNode, Action } from '../../../api/worldInteraction/worldInteractionApi.type';
import { getImageUrl, CHARACTER_GENERATION_COST } from '../../../utils/constants';
import { addImageTimestamp } from '../../../utils/imageCache';
import worldEditor from '../../../api/worldInteraction/worldEditor';
import { useGameStore } from '../../../store/gameStore';
import { useWordLimit, useWordCount } from '../../../hooks/editor/useWordLimit';

// 字数限制配置
const FUNCTIONAL_NPC_WORD_LIMITS = {
    authorNote: 20,
    actionName: 20,
    actionDescription: 100,
} as const;

// Action 字段组件（用于处理字数限制）
interface ActionFieldProps {
    action: Action;
    field: 'name' | 'description';
    label: string;
    placeholder: string;
    limit: number;
    onChange: (value: string) => void;
    isTextarea?: boolean;
}

const ActionField: React.FC<ActionFieldProps> = ({ action, field, label, placeholder, limit, onChange, isTextarea = false }) => {
    const value = action[field] || '';
    const wordCount = useWordCount(value);
    const wordLimit = useWordLimit(limit, onChange);

    return (
        <label>
            <div className={styles.labelRowWithCounter}>
                <span>{label} <span className={sharedStyles.required}>*</span></span>
                <span className={styles.wordCounter}>
                    {wordCount}/{limit}
                </span>
            </div>
            {isTextarea ? (
                <textarea
                    rows={2}
                    value={value}
                    {...wordLimit}
                    placeholder={placeholder}
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    {...wordLimit}
                    placeholder={placeholder}
                />
            )}
        </label>
    );
};

interface FunctionalNPCDetailProps {
    node: AbilityNode | null;
    onSave: (updatedNode: AbilityNode) => void;
    fileId?: string | null;
    isNewNode?: boolean; // 标识是否为新建节点
    onHasUnsavedChanges?: (hasChanges: boolean) => void; // 通知父组件是否有未保存的修改
}

const FunctionalNPCDetail = React.forwardRef<{ save: () => Promise<void>; checkOnlyImageChanged: () => boolean }, FunctionalNPCDetailProps>(
    (props, ref) => {
    const {
        node,
        onSave,
        fileId,
        isNewNode: isNewNodeProp,
        onHasUnsavedChanges,
    } = props;
    const { fileId: storeFileId } = useGameStore();
    const currentFileId = fileId || storeFileId;
    const { t } = useTranslation();

    const [formData, setFormData] = useState<Partial<AbilityNode>>({
        node_id: '',
        authorNote: '',
        name: '', // 按钮型NPC的按钮文字
        type: 'illustration',
        imagePath: '',
        imagePrompt: '',
        actions: [],
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSelectOpen, setIsSelectOpen] = useState(false);
    const [singleGenerateModalOpen, setSingleGenerateModalOpen] = useState(false);
    const [deleteActionModalOpen, setDeleteActionModalOpen] = useState(false);
    const [actionToDelete, setActionToDelete] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const DEFAULT_NPC_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultNpc.png`;
    const [localFile, setLocalFile] = useState<File | null>(null);
    const [tempImageId, setTempImageId] = useState<string | null>(null);

    // 保存原始节点数据，用于比较是否有修改
    const originalNodeRef = React.useRef<AbilityNode | null>(null);

    // 当node变化时，更新表单数据
    React.useEffect(() => {
        if (node) {
            originalNodeRef.current = JSON.parse(JSON.stringify(node)); // 深拷贝
            setFormData({
                node_id: node.node_id || '',
                authorNote: node.authorNote || '',
                name: node.name || '', // 按钮型NPC的按钮文字
                type: node.type || 'illustration',
                imagePath: node.imagePath || '',
                imagePrompt: node.imagePrompt || '',
                actions: node.actions && node.actions.length > 0 ? node.actions : [{ id: `opt-${Date.now()}`, name: '', description: '' }],
            });
            setLocalFile(null);
            setTempImageId(null);
            // 重置未保存状态
            if (onHasUnsavedChanges) {
                onHasUnsavedChanges(false);
            }
        } else {
            originalNodeRef.current = null;
            setFormData({
                node_id: '',
                authorNote: '',
                name: '', // 按钮型NPC的按钮文字
                type: 'illustration',
                imagePath: '',
                imagePrompt: '',
                actions: [{ id: `opt-${Date.now()}`, name: '', description: '' }],
            });
            setLocalFile(null);
            setTempImageId(null);
            // 重置未保存状态
            if (onHasUnsavedChanges) {
                onHasUnsavedChanges(false);
            }
        }
    }, [node, onHasUnsavedChanges]);

    // 检测是否只修改了图片
    const checkOnlyImageChanged = React.useCallback((): boolean => {
        if (!node || !originalNodeRef.current) {
            // 新建节点：只检查是否有图片相关修改，且没有其他内容
            if (isNewNodeProp) {
                const hasImageChange = !!(formData.imagePath || localFile || tempImageId);
                const hasOtherContent = !!(
                    formData.authorNote?.trim() ||
                    formData.name?.trim() ||
                    (formData.actions && formData.actions.some((a: any) => a.name?.trim() || a.description?.trim()))
                );
                return hasImageChange && !hasOtherContent;
            }
            return false;
        }

        // 比较原始节点和当前表单数据，检查是否只有图片相关字段变化
        const original = originalNodeRef.current;
        const imageChanged = 
            formData.imagePath !== (original.imagePath || '') ||
            localFile !== null ||
            tempImageId !== null;
        
        const otherFieldsChanged = 
            formData.authorNote !== (original.authorNote || '') ||
            formData.name !== (original.name || '') ||
            formData.type !== (original.type || 'illustration') ||
            formData.imagePrompt !== (original.imagePrompt || '') ||
            JSON.stringify(formData.actions) !== JSON.stringify(original.actions || []);

        return imageChanged && !otherFieldsChanged;
    }, [node, formData, localFile, tempImageId, isNewNodeProp]);

    // 检测是否有未保存的修改
    const checkUnsavedChanges = React.useCallback(() => {
        if (!node || !originalNodeRef.current) {
            // 新建节点：检查是否有任何内容
            if (isNewNodeProp) {
                const hasContent = 
                    formData.authorNote?.trim() ||
                    formData.name?.trim() ||
                    formData.imagePath ||
                    localFile ||
                    tempImageId ||
                    (formData.actions && formData.actions.some((a: any) => a.name?.trim() || a.description?.trim()));
                return hasContent;
            }
            return false;
        }

        // 比较原始节点和当前表单数据
        const original = originalNodeRef.current;
        const hasChanges = 
            formData.authorNote !== (original.authorNote || '') ||
            formData.name !== (original.name || '') ||
            formData.type !== (original.type || 'illustration') ||
            formData.imagePath !== (original.imagePath || '') ||
            formData.imagePrompt !== (original.imagePrompt || '') ||
            localFile !== null ||
            tempImageId !== null ||
            JSON.stringify(formData.actions) !== JSON.stringify(original.actions || []);

        return hasChanges;
    }, [node, formData, localFile, tempImageId, isNewNodeProp]);

    // 当表单数据变化时，通知父组件
    React.useEffect(() => {
        if (onHasUnsavedChanges) {
            const hasChanges = checkUnsavedChanges();
            onHasUnsavedChanges(!!hasChanges);
        }
    }, [formData, localFile, tempImageId, checkUnsavedChanges, onHasUnsavedChanges]);

    const handleFieldChange = (field: keyof AbilityNode, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddAction = () => {
        const currentActions = formData.actions || [];
        if (currentActions.length >= 5) {
            toast.error('最多只能添加5个功能');
            return;
        }
        const newAction: Action = {
            id: `opt-${Date.now()}`,
            name: '',
            description: '',
        };
        setFormData(prev => ({
            ...prev,
            actions: [...(prev.actions || []), newAction],
        }));
    };

    const handleRemoveAction = (actionId: string) => {
        const currentActions = formData.actions || [];
        if (currentActions.length <= 1) {
            toast.error('至少需要保留1个功能事件');
            return;
        }
        // 打开确认弹窗
        setActionToDelete(actionId);
        setDeleteActionModalOpen(true);
    };

    const handleConfirmDeleteAction = async () => {
        if (!actionToDelete) return;
        
        const currentActions = formData.actions || [];
        if (currentActions.length <= 1) {
            toast.error('至少需要保留1个功能事件，无法删除');
            setDeleteActionModalOpen(false);
            setActionToDelete(null);
            return;
        }

        const isNewAction = !originalNodeRef.current?.actions?.some(
            (originalAction) => originalAction.id === actionToDelete
        );

        // 只有已保存的action才需要调用API删除
        if (!isNewAction && node?.node_id && currentFileId) {
            try {
                const action = currentActions.find(a => a.id === actionToDelete);
                if (action) {
                    const response = await worldEditor.deleteFunctionalEvent(currentFileId, node.node_id, actionToDelete);
                    if (response.data?.success === false) {
                        toast.error(response.data.message || '删除失败，请稍后重试');
                        setDeleteActionModalOpen(false);
                        setActionToDelete(null);
                        return;
                    }
                    toast.success('功能事件删除成功');
                }
            } catch (error: any) {
                console.error('删除功能事件失败:', error);
                toast.error('删除失败：' + (error.message || '请检查网络连接'));
                setDeleteActionModalOpen(false);
                setActionToDelete(null);
                return;
            }
        }

        // 从表单中移除该 action（无论是新增的还是已保存的）
        setFormData(prev => ({
            ...prev,
            actions: (prev.actions || []).filter(action => action.id !== actionToDelete),
        }));

        setDeleteActionModalOpen(false);
        setActionToDelete(null);
    };

    const handleCancelDeleteAction = () => {
        setDeleteActionModalOpen(false);
        setActionToDelete(null);
    };

    const handleActionChange = (actionId: string, field: 'name' | 'description', value: string) => {
        setFormData(prev => ({
            ...prev,
            actions: (prev.actions || []).map(action =>
                action.id === actionId ? { ...action, [field]: value } : action
            ),
        }));
    };

    // 字数统计
    const authorNoteWords = useWordCount(formData.authorNote ?? '');
    
    // 字数限制处理
    const authorNoteLimit = useWordLimit(FUNCTIONAL_NPC_WORD_LIMITS.authorNote, (value) => handleFieldChange('authorNote', value));

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast.error('请选择图片文件');
                return;
            }

            setLocalFile(file);
            setTempImageId(null);
            // 创建本地预览URL
            const imageUrl = URL.createObjectURL(file);
            setFormData(prev => ({ ...prev, imagePath: imageUrl }));
            toast.success('图片已选择');
        }
        // 清空input，允许重复选择同一文件
        e.target.value = '';
    };

    const handleGenerateImageClick = () => {
        if (!formData.imagePrompt?.trim()) {
            toast.error('请先输入图片提示词');
            return;
        }
        setSingleGenerateModalOpen(true);
    };

    const handleConfirmGenerateImage = async () => {
        if (!currentFileId || !formData.imagePrompt?.trim()) {
            toast.error('请先输入图片提示词');
            setSingleGenerateModalOpen(false);
            return;
        }

        setIsGenerating(true);
        setSingleGenerateModalOpen(false);
        try {
            const response = await worldEditor.generateFunctionalNPCImage(currentFileId, formData.imagePrompt || '');
            const responseData = response.data;
            if (responseData.success && responseData.result) {
                if (responseData.result) {
                    if (responseData.result.tempImageId) {
                        setTempImageId(responseData.result.tempImageId);
                    }
                    setLocalFile(null);
                    const imagePath = responseData.result.url;
                    setFormData(prev => ({ ...prev, imagePath }));
                    toast.success('图片生成成功');
                }
            }
        } catch (error: any) {
            console.error('生成图片失败:', error);
            toast.error('图片生成失败：' + (error.message || '请检查网络连接'));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCancelGenerateImage = () => {
        setSingleGenerateModalOpen(false);
    };

    const handleSave = async () => {
        // 验证必填字段
        if (!formData.authorNote?.trim()) {
            toast.error('请输入NPC名称');
            return;
        }

        // illustration 型需要验证图片
        if (formData.type === 'illustration' && !formData.imagePath && !localFile && !tempImageId) {
            toast.error('请上传或生成图片');
            return;
        }
        // button 型需要校验按钮文字
        if (formData.type === 'button' && !formData.name?.trim()) {
            toast.error('请输入按钮文字');
            return;
        }

        if (!formData.actions || formData.actions.length === 0) {
            toast.error('至少需要添加1个功能');
            return;
        }
        if (formData.actions.length > 5) {
            toast.error('最多只能添加5个功能');
            return;
        }
        for (const action of formData.actions) {
            if (!action.name.trim()) {
                toast.error('请填写完整的功能信息');
                return;
            }
        }

        if (!currentFileId) {
            toast.error('缺少必要数据，无法保存');
            return;
        }

        setIsSaving(true);

        try {
            // 优先使用传入的 isNewNode 属性，如果没有则根据 node_id 判断
            const isNewNode = isNewNodeProp !== undefined ? isNewNodeProp : !node?.node_id;
            
            let response;
            
            // 如果有文件，使用 FormData 格式
            if (localFile) {
                const formDataToSend = new FormData();
                formDataToSend.append('image', localFile);
                
                formDataToSend.append('node_id', node?.node_id || `node-${Date.now()}`);
                formDataToSend.append('authorNote', formData.authorNote || '');
                if (formData.type === 'button' && formData.name) {
                    formDataToSend.append('name', formData.name.trim());
                }
                formDataToSend.append('type', formData.type || 'illustration');
                formDataToSend.append('imagePath', formData.imagePath || '');
                formDataToSend.append('imagePrompt', formData.imagePrompt || '');
                formDataToSend.append('actions', JSON.stringify(formData.actions || []));
                
                if (isNewNode) {
                    response = await worldEditor.addFunctionalNpc(currentFileId, formDataToSend);
                } else {
                    if (!node?.node_id) {
                        toast.error('缺少节点ID，无法更新');
                        setIsSaving(false);
                        return;
                    }
                    response = await worldEditor.updateFunctionalNpc(currentFileId, node.node_id, formDataToSend);
                }
            } else {
                // 如果没有文件，使用普通 JSON 格式
                // 构建节点数据，如果有tempImageId则添加
                const nodeData: AbilityNode = {
                    node_id: node?.node_id || `node-${Date.now()}`,
                    authorNote: formData.authorNote!,
                    name: formData.type === 'button' ? formData.name?.trim() : undefined,
                    type: formData.type || 'illustration',
                    imagePath: formData.imagePath || '',
                    imagePrompt: formData.imagePrompt || '',
                    actions: formData.actions || [],
                    ...(tempImageId ? { tempImageId } : {}),
                };
                
                // 调用 API
                if (isNewNode) {
                    response = await worldEditor.addFunctionalNpc(currentFileId, nodeData);
                } else {
                    if (!node?.node_id) {
                        toast.error('缺少节点ID，无法更新');
                        setIsSaving(false);
                        return;
                    }
                    response = await worldEditor.updateFunctionalNpc(currentFileId, node.node_id, nodeData);
                }
            }
            
            if (response.data?.success) {
                const savedNode = response.data?.node;
                if (savedNode) {
                    // 通过 onSave 回调更新父组件状态
                    await onSave(savedNode);
                    // 更新原始节点引用，重置未保存状态
                    originalNodeRef.current = JSON.parse(JSON.stringify(savedNode));
                    if (onHasUnsavedChanges) {
                        onHasUnsavedChanges(false);
                    }
                } else {
                    // 如果没有返回节点，构建节点数据传递给父组件
                    const nodeData: AbilityNode = {
                        node_id: node?.node_id || `node-${Date.now()}`,
                        authorNote: formData.authorNote!,
                        name: formData.type === 'button' ? formData.name?.trim() : undefined,
                        type: formData.type || 'illustration',
                        imagePath: formData.imagePath || '',
                        imagePrompt: formData.imagePrompt || '',
                        actions: formData.actions || [],
                    };
                    await onSave(nodeData);
                    // 更新原始节点引用，重置未保存状态
                    originalNodeRef.current = JSON.parse(JSON.stringify(nodeData));
                    if (onHasUnsavedChanges) {
                        onHasUnsavedChanges(false);
                    }
                }
            } else {
                toast.error(response.data?.message || '保存失败');
                setIsSaving(false);
                return;
            }
            
            // 提交成功后，清除tempImageId和本地文件
            setTempImageId(null);
            setLocalFile(null);
        } catch (error: any) {
            console.error('保存失败:', error);
            toast.error('保存失败：' + (error.message || '请检查网络连接'));
        } finally {
            setIsSaving(false);
        }
    };

    // 暴露 save 和 checkOnlyImageChanged 方法给父组件
    useImperativeHandle(ref, () => ({
        save: handleSave,
        checkOnlyImageChanged: checkOnlyImageChanged,
    }));

    return (
        <div className={styles.npcDetail}>
            <div className={styles.typeSwitchRow}>
                <label>
                    <span className={styles.typeLabel}>{t('createGame.npcType')} <span className={sharedStyles.required}>*</span></span>
                    <div className={styles.typeSelectWrapper}>
                        <select
                            value={formData.type}
                            onChange={(e) => {
                                handleFieldChange('type', e.target.value);
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
                            <option value="illustration">立绘型</option>
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
                            <div className={styles.labelRowWithCounter}>
                                <span>{t('createGame.npcName')} <span className={sharedStyles.required}>*</span></span>
                                <span className={styles.wordCounter}>
                                    {authorNoteWords}/{FUNCTIONAL_NPC_WORD_LIMITS.authorNote}
                                </span>
                            </div>
                            <input
                                type="text"
                                value={formData.authorNote}
                                {...authorNoteLimit}
                                placeholder="输入NPC名称"
                            />
                        </label>
                    </div>

                    {formData.type === 'illustration' && (
                        <div className={styles.formGroup}>
                            <label>
                                <span>立绘图 <span className={sharedStyles.required}>*</span></span>
                                <div className={styles.imageUploadRow}>
                                    {/* 左侧：提示词表单 + AI生成按钮 */}
                                    <div className={styles.imagePromptSection}>
                                        <div className={styles.imagePromptInput}>
                                            <textarea
                                                rows={4}
                                                value={formData.imagePrompt || ''}
                                                onChange={(e) => handleFieldChange('imagePrompt', e.target.value)}
                                                placeholder="用于AI生成图片的提示词"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            className={sharedStyles.ghostSmall}
                                            onClick={handleGenerateImageClick}
                                            disabled={isGenerating}
                                        >
                                            <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" style={{ width: '16px', height: '16px' }} />
                                            {isGenerating ? '生成中...' : `${CHARACTER_GENERATION_COST} AI生成`}
                                        </button>
                                    </div>
                                    {/* 右侧：图片预览 + 上传按钮 */}
                                    <div className={styles.imagePreviewSection}>
                                        <div className={styles.imagePreviewWrapper}>
                                            {formData.imagePath ? (
                                                <div className={styles.imagePreview}>
                                                    <img
                                                        src={formData.imagePath.startsWith('blob:') ? formData.imagePath : addImageTimestamp(getImageUrl(formData.imagePath))}
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
                                            {/* 单个图片生成加载效果 */}
                                            {isGenerating && (
                                                <div className={styles.loadingOverlay}>
                                                    <div className={styles.loadingSpinner}></div>
                                                    <div className={styles.loadingText}>正在生成图片...</div>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className={sharedStyles.ghostSmall}
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isGenerating}
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
                                    value={formData.name || ''}
                                    onChange={(e) => handleFieldChange('name', e.target.value)}
                                    placeholder="输入按钮显示的文字"
                                />
                            </label>
                        </div>
                    )}

                    <div className={styles.formGroup}>
                        <div className={styles.optionsHeader}>
                            <span>功能列表 <span className={sharedStyles.required}>*</span>（最少1个，最多5个）</span>
                            <button
                                type="button"
                                className={sharedStyles.ghostSmall}
                                onClick={handleAddAction}
                                disabled={(formData.actions || []).length >= 5}
                            >
                                + 新增功能
                            </button>
                        </div>
                        <div className={styles.optionsList}>
                            {formData.actions && formData.actions.length > 0 ? (
                                formData.actions.map((action) => (
                                    <div key={action.id} className={styles.optionItem}>
                                        <div className={styles.optionHeader}>
                                            <span>功能 {formData.actions!.indexOf(action) + 1}</span>
                                            <button
                                                type="button"
                                                className={styles.deleteButton}
                                                onClick={() => handleRemoveAction(action.id)}
                                            >
                                                删除
                                            </button>
                                        </div>
                                        <div className={styles.optionFields}>
                                            <ActionField
                                                action={action}
                                                field="name"
                                                label="功能名称"
                                                placeholder="游戏端展示的功能名称"
                                                limit={FUNCTIONAL_NPC_WORD_LIMITS.actionName}
                                                onChange={(value) => handleActionChange(action.id, 'name', value)}
                                            />
                                            <ActionField
                                                action={action}
                                                field="description"
                                                label="描述"
                                                placeholder="给大模型用的提示词"
                                                limit={FUNCTIONAL_NPC_WORD_LIMITS.actionDescription}
                                                onChange={(value) => handleActionChange(action.id, 'description', value)}
                                                isTextarea
                                            />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className={styles.emptyOptions}>
                                    <p>暂无功能，点击"新增功能"添加</p>
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

            {/* 单张图片生成积分确认弹窗 */}
            <ConfirmModal
                isOpen={singleGenerateModalOpen}
                onConfirm={handleConfirmGenerateImage}
                onCancel={handleCancelGenerateImage}
                title="积分扣除确认"
                message={`本次生成图片将扣除 ${CHARACTER_GENERATION_COST} 积分，是否继续？`}
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />

            {/* 删除功能事件确认弹窗 */}
            <ConfirmModal
                isOpen={deleteActionModalOpen}
                onConfirm={handleConfirmDeleteAction}
                onCancel={handleCancelDeleteAction}
                title="删除功能事件"
                message={
                    (() => {
                        const action = formData.actions?.find(a => a.id === actionToDelete);
                        const actionName = action?.name || '该功能事件';
                        const remainingCount = (formData.actions?.length || 0) - 1;
                        return `确定要删除功能事件 "${actionName}" 吗？${remainingCount === 1 ? '删除后将只剩1个功能事件。' : ''}删除后不可恢复。`;
                    })()
                }
                confirmButtonText="确认删除"
                cancelButtonText="取消"
            />
        </div>
    );
    }
);

FunctionalNPCDetail.displayName = 'FunctionalNPCDetail';

export default FunctionalNPCDetail;
