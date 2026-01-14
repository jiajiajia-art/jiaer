import React, { useState, useRef, useEffect, useImperativeHandle } from 'react';
import styles from './ObjectDetail.module.css';
import sharedStyles from './shared.module.css';
import ConfirmModal from '../../GoodsModal/ConfirmModal';
import { toast } from 'react-hot-toast';
import { getImageUrl, IMAGE_GENERATION_COST, addImageTimestamp } from '../../../utils/constants';
import type { ObjectItem } from '../../../api/worldInteraction/objectsData.type';
import { objectsData } from '../../../api/worldInteraction/objectsData';

interface ObjectDetailProps {
    object: ObjectItem | null;
    onSave: (updatedObject: ObjectItem) => void;
    fileId?: string | null;
    isNewObject?: boolean;
    onHasUnsavedChanges?: (hasChanges: boolean) => void;
}

const ObjectDetail = React.forwardRef<{ save: () => Promise<void>; checkOnlyImageChanged: () => boolean }, ObjectDetailProps>(({
    object,
    onSave,
    fileId,
    isNewObject: isNewObjectProp,
    onHasUnsavedChanges,
}, ref) => {
    const [formData, setFormData] = useState<Partial<ObjectItem>>({
        item_id: '',
        name: '新建物品',
        category: 'consumable',
        stackable: false,
        icon: '',
        description: '',
        functionalDescription: '',
        acquisition: {
            source: 'ability_node',
            condition: '',
        },
        otherNotes: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSelectOpen, setIsSelectOpen] = useState<{ [key: string]: boolean }>({});
    const [generateModalOpen, setGenerateModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [localFile, setLocalFile] = useState<File | null>(null);
    const [tempImageId, setTempImageId] = useState<string | null>(null);

    // 保存原始数据，用于比较是否有修改
    const originalObjectRef = React.useRef<ObjectItem | null>(null);
    // 标记是否正在初始化（避免初始化期间触发未保存检查）
    const isInitializingRef = React.useRef<boolean>(false);

    // 当 object 变化时，更新表单数据
    useEffect(() => {
        isInitializingRef.current = true;
        
        if (object) {
            // 解析后端可能返回的 JSON 字符串
            let parsedAcquisition = object.acquisition;
            if (typeof object.acquisition === 'string') {
                try {
                    parsedAcquisition = JSON.parse(object.acquisition);
                } catch (e) {
                    console.error('解析 acquisition 失败:', e);
                    parsedAcquisition = {
                        source: 'ability_node',
                        condition: '',
                    };
                }
            }
            
            // 规范化数据
            const normalizedObject = {
                ...object,
                stackable: typeof object.stackable === 'string' 
                    ? object.stackable === 'true' 
                    : Boolean(object.stackable),
                acquisition: parsedAcquisition || {
                    source: 'npc',
                    sourceId: '',
                    condition: '',
                },
            };
            
            originalObjectRef.current = JSON.parse(JSON.stringify(normalizedObject));
            
            setFormData({
                item_id: normalizedObject.item_id || '',
                name: normalizedObject.name || '新建物品',
                category: normalizedObject.category || 'consumable',
                stackable: normalizedObject.stackable,
                icon: normalizedObject.icon || '',
                description: normalizedObject.description || '',
                functionalDescription: normalizedObject.functionalDescription || '',
                acquisition: normalizedObject.acquisition,
                otherNotes: normalizedObject.otherNotes || '',
            });
            setLocalFile(null);
            setTempImageId(null);
            
            // 使用 setTimeout 确保 formData 更新后再结束初始化
            setTimeout(() => {
                isInitializingRef.current = false;
                if (onHasUnsavedChanges) {
                    onHasUnsavedChanges(false);
                }
            }, 0);
        } else {
            originalObjectRef.current = null;
            setFormData({
                item_id: '',
                name: '新建物品',
                category: 'consumable',
                stackable: false,
                icon: '',
                description: '',
                functionalDescription: '',
                acquisition: {
                    source: 'ability_node',
                    condition: '',
                },
                otherNotes: '',
            });
            setLocalFile(null);
            setTempImageId(null);
            
            // 使用 setTimeout 确保 formData 更新后再结束初始化
            setTimeout(() => {
                isInitializingRef.current = false;
                if (onHasUnsavedChanges) {
                    onHasUnsavedChanges(false);
                }
            }, 0);
        }
    }, [object, onHasUnsavedChanges]);

    // 检测是否只修改了图片
    const checkOnlyImageChanged = React.useCallback((): boolean => {
        if (!object || !originalObjectRef.current) {
            // 新建物品：只检查是否有图片相关修改，且没有其他内容
            if (isNewObjectProp) {
                const hasImageChange = !!(formData.icon || localFile || tempImageId);
                const hasOtherContent = !!(
                    formData.name?.trim() !== '新建物品' ||
                    formData.description?.trim() ||
                    formData.functionalDescription?.trim() ||
                    (formData.acquisition?.source && formData.acquisition.source !== 'ability_node') ||
                    (formData.acquisition?.condition && formData.acquisition.condition !== '') ||
                    formData.otherNotes?.trim()
                );
                return hasImageChange && !hasOtherContent;
            }
            return false;
        }

        // 比较原始物品和当前表单数据，检查是否只有图片相关字段变化
        const original = originalObjectRef.current;
        const imageChanged = 
            formData.icon !== (original.icon || '') ||
            localFile !== null ||
            tempImageId !== null;
        
        const otherFieldsChanged = 
            formData.name !== (original.name || '') ||
            formData.category !== (original.category || 'consumable') ||
            formData.stackable !== original.stackable ||
            formData.description !== (original.description || '') ||
            formData.functionalDescription !== (original.functionalDescription || '') ||
            formData.acquisition?.source !== (original.acquisition?.source || '') ||
            formData.acquisition?.condition !== (original.acquisition?.condition || '') ||
            formData.otherNotes !== (original.otherNotes || '');

        return imageChanged && !otherFieldsChanged;
    }, [object, formData, localFile, tempImageId, isNewObjectProp]);

    // 检测是否有未保存的修改
    const checkUnsavedChanges = React.useCallback(() => {
        if (!object || !originalObjectRef.current) {
            if (isNewObjectProp) {
                return formData.name?.trim() !== '新建物品' ||
                    formData.icon ||
                    localFile ||
                    formData.description?.trim() ||
                    formData.functionalDescription?.trim() ||
                    (formData.acquisition?.source && formData.acquisition.source !== 'ability_node') ||
                    (formData.acquisition?.condition && formData.acquisition.condition !== '') ||
                    formData.otherNotes?.trim();
            }
            return false;
        }

        const original = originalObjectRef.current;        
        return formData.name !== (original.name || '') ||
            formData.category !== (original.category || 'consumable') ||
            formData.stackable !== original.stackable ||
            formData.icon !== (original.icon || '') ||
            formData.description !== (original.description || '') ||
            formData.functionalDescription !== (original.functionalDescription || '') ||
            formData.acquisition?.source !== (original.acquisition?.source || '') ||
            formData.acquisition?.condition !== (original.acquisition?.condition || '') ||
            formData.otherNotes !== (original.otherNotes || '') ||
            localFile !== null ||
            tempImageId !== null;
    }, [object, formData, localFile, tempImageId, isNewObjectProp]);

    // 当表单数据变化时，通知父组件
    useEffect(() => {
        if (isInitializingRef.current) {
            return;
        }
        
        if (onHasUnsavedChanges) {
            const hasChanges = checkUnsavedChanges();
            onHasUnsavedChanges(!!hasChanges);
        }
    }, [formData, localFile, checkUnsavedChanges, onHasUnsavedChanges]);

    const handleFieldChange = (field: keyof ObjectItem | string, value: any) => {
        if (field.includes('.')) {
            // 处理嵌套字段，如 'acquisition.source'
            const [parent, child] = field.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...(prev[parent as keyof ObjectItem] as any),
                    [child]: value
                }
            }));
        } else {
            setFormData(prev => ({ ...prev, [field]: value }));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast.error('请选择图片文件');
                return;
            }
            setLocalFile(file);
            const imageUrl = URL.createObjectURL(file);
            setFormData(prev => ({ ...prev, icon: imageUrl }));
            toast.success('图片已选择');
        }
        e.target.value = '';
    };

    const handleGenerateImageClick = () => {
        if (!formData.description?.trim()) {
            toast.error('请先输入物品描述作为图片提示词');
            return;
        }
        setGenerateModalOpen(true);
    };

    const handleConfirmGenerateImage = async () => {
        if (!fileId) {
            toast.error('缺少必要数据');
            return;
        }
        
        setIsGenerating(true);
        setGenerateModalOpen(false);
        try {
            const response = await objectsData.generateObjectImage(fileId, formData.description || '');
            if (response.data?.success) {
                setTempImageId(response.data.tempImageId);
                setFormData(prev => ({ ...prev, icon: response.data.url }));
                setLocalFile(null);
                toast.success('图片生成成功');
            } else {
                toast.error('图片生成失败');
            }
        } catch (error: any) {
            console.error('生成图片失败:', error);
            toast.error('图片生成失败：' + (error.message || '请检查网络连接'));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCancelGenerateImage = () => {
        setGenerateModalOpen(false);
    };

    const handleSave = async () => {
        if (!formData.name?.trim() || formData.name === '新建物品') {
            toast.error('请输入物品名称');
            return;
        }

        if (!fileId) {
            toast.error('缺少必要数据，无法保存');
            return;
        }

        setIsSaving(true);

        try {
            const isNewObject = isNewObjectProp !== undefined ? isNewObjectProp : !object?.item_id;
            
            let savedObject: ObjectItem;
            
            // 构建 FormData
            const formDataToSend = new FormData();
            formDataToSend.append('name', formData.name!);
            formDataToSend.append('category', formData.category!);
            formDataToSend.append('stackable', formData.stackable!.toString());
            formDataToSend.append('description', formData.description || '');
            formDataToSend.append('functionalDescription', formData.functionalDescription || '');
            
            // acquisition 字段展开（避免 JSON 字符串的解析问题）
            formDataToSend.append('acquisition[source]', formData.acquisition?.source || 'npc');
            formDataToSend.append('acquisition[condition]', formData.acquisition?.condition || '');
            
            formDataToSend.append('otherNotes', formData.otherNotes || '');
            
            // 图片处理：优先使用本地上传的文件
            if (localFile) {
                formDataToSend.append('image', localFile);
                console.log('[ObjectDetail] 保存时传递文件:', localFile.name, localFile.size, 'type:', localFile.type);
            } 
            // 如果有 AI 生成的图片，使用 tempImageId
            else if (tempImageId) {
                formDataToSend.append('tempImageId', tempImageId);
                console.log('[ObjectDetail] 保存时传递 tempImageId:', tempImageId);
            }
            // 如果既没有文件也没有 tempImageId，但有 icon URL（且不是 blob URL），传递 icon
            else if (formData.icon && !formData.icon.startsWith('blob:')) {
                formDataToSend.append('icon', formData.icon);
                console.log('[ObjectDetail] 保存时传递 icon URL:', formData.icon);
            } else {
                console.warn('[ObjectDetail] 保存时没有图片信息: localFile=', localFile, 'tempImageId=', tempImageId, 'icon=', formData.icon);
            }
            
            if (isNewObject) {
                // 新建物品
                const response = await objectsData.addObject(fileId, formDataToSend);
                if (response.data?.success) {
                    savedObject = response.data.item;
                } else {
                    throw new Error(response.data?.message || '创建失败');
                }
            } else {
                // 更新物品
                const response = await objectsData.updateObject(fileId, object!.item_id, formDataToSend);
                if (response.data?.success) {
                    savedObject = response.data.item;
                } else {
                    throw new Error(response.data?.message || '更新失败');
                }
            }
            
            await onSave(savedObject);
            originalObjectRef.current = JSON.parse(JSON.stringify(savedObject));
            if (onHasUnsavedChanges) {
                onHasUnsavedChanges(false);
            }
            setLocalFile(null);
            setTempImageId(null);
            toast.success(isNewObject ? '物品已创建' : '物品已保存');
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

    if (!object && !isNewObjectProp) {
        return (
            <div className={styles.objectDetail}>
                <div className={styles.emptyDetail}>
                    <p>请选择一个物品进行编辑</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.objectDetail}>
            <div className={styles.detailForm}>
                <div className={styles.formSection}>
                    {/* 物品图标 */}
                    <div className={styles.formGroup}>
                        <label>
                            <span>物品图标 <span className={sharedStyles.required}>*</span></span>
                            <div className={styles.imageUploadRow}>
                                <div className={styles.imagePromptSection}>
                                    <div className={styles.imagePromptInput}>
                                        <textarea
                                            rows={3}
                                            value={formData.description}
                                onChange={(e) => handleFieldChange('description', e.target.value)}
                                            placeholder="用于AI生成图片的提示词"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className={sharedStyles.ghostSmall}
                                        onClick={handleGenerateImageClick}
                                        disabled={isGenerating}
                                    >
                                        {isGenerating ? '生成中...' : `${IMAGE_GENERATION_COST} 积分 AI生成`}
                                    </button>
                                </div>
                                <div className={styles.imagePreviewSection}>
                                    <div className={styles.imagePreviewWrapper}>
                                        {formData.icon ? (
                                            <div className={styles.imagePreview}>
                                                <img
                                                    src={formData.icon.startsWith('blob:') ? formData.icon : addImageTimestamp(getImageUrl(formData.icon))}
                                                    alt="物品预览"
                                                />
                                            </div>
                                        ) : (
                                            <div className={styles.imagePlaceholder}>
                                                <span>暂无图片</span>
                                            </div>
                                        )}
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

                    {/* 物品名称 */}
                    <div className={styles.formGroup}>
                        <label>
                            <span>物品名称 <span className={sharedStyles.required}>*</span></span>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleFieldChange('name', e.target.value)}
                                placeholder="输入物品名称"
                            />
                        </label>
                    </div>

                    {/* 物品分类 */}
                    <div className={styles.formGroup}>
                        <label>
                            <span>物品分类 <span className={sharedStyles.required}>*</span></span>
                            <div className={styles.selectWrapper}>
                                <select
                                    value={formData.category}
                                    onChange={(e) => {
                                        handleFieldChange('category', e.target.value);
                                        requestAnimationFrame(() => {
                                            setIsSelectOpen(prev => ({ ...prev, category: false }));
                                        });
                                    }}
                                    onMouseDown={() => {
                                        setIsSelectOpen(prev => ({ ...prev, category: !prev.category }));
                                    }}
                                    onBlur={() => {
                                        requestAnimationFrame(() => {
                                            setIsSelectOpen(prev => ({ ...prev, category: false }));
                                        });
                                    }}
                                    className={styles.select}
                                >
                                    <option value="consumable">消耗类物品</option>
                                    <option value="non-consumable">非消耗类物品</option>
                                </select>
                                <span className={`${styles.selectArrow} ${isSelectOpen.category ? styles.selectArrowOpen : ''}`}></span>
                            </div>
                        </label>
                    </div>

                    {/* 是否可以堆叠 */}
                    <div className={styles.formGroup}>
                        <label>
                            <span>是否可以堆叠 <span className={sharedStyles.required}>*</span></span>
                            <div className={styles.selectWrapper}>
                                <select
                                    value={formData.stackable ? 'true' : 'false'}
                                    onChange={(e) => {
                                        handleFieldChange('stackable', e.target.value === 'true');
                                        requestAnimationFrame(() => {
                                            setIsSelectOpen(prev => ({ ...prev, stackable: false }));
                                        });
                                    }}
                                    onMouseDown={() => {
                                        setIsSelectOpen(prev => ({ ...prev, stackable: !prev.stackable }));
                                    }}
                                    onBlur={() => {
                                        requestAnimationFrame(() => {
                                            setIsSelectOpen(prev => ({ ...prev, stackable: false }));
                                        });
                                    }}
                                    className={styles.select}
                                >
                                    <option value="true">是</option>
                                    <option value="false">否</option>
                                </select>
                                <span className={`${styles.selectArrow} ${isSelectOpen.stackable ? styles.selectArrowOpen : ''}`}></span>
                            </div>
                        </label>
                    </div>


                    {/* 物品功能描述 */}
                    <div className={styles.formGroup}>
                        <label>
                            <span>物品功能描述 <span className={sharedStyles.required}>*</span></span>
                            <textarea
                                rows={4}
                                value={formData.functionalDescription}
                                onChange={(e) => handleFieldChange('functionalDescription', e.target.value)}
                                placeholder="用作ai推演的物品的功能性描述（如：提供抗毒效果、提升生命值50点等），尽量描述详细、可量化，作为ai推演使用"
                            />
                        </label>
                    </div>

                    {/* 物品获取途径 */}
                    <div className={styles.formGroup}>
                        <label>
                            <span>物品获取途径 <span className={sharedStyles.required}>*</span></span>
                            <div className={styles.selectWrapper}>
                                <select
                                    value={formData.acquisition?.source}
                                    onChange={(e) => {
                                        handleFieldChange('acquisition.source', e.target.value);
                                        requestAnimationFrame(() => {
                                            setIsSelectOpen(prev => ({ ...prev, obtainMethod: false }));
                                        });
                                    }}
                                    onMouseDown={() => {
                                        setIsSelectOpen(prev => ({ ...prev, obtainMethod: !prev.obtainMethod }));
                                    }}
                                    onBlur={() => {
                                        requestAnimationFrame(() => {
                                            setIsSelectOpen(prev => ({ ...prev, obtainMethod: false }));
                                        });
                                    }}
                                    className={styles.select}
                                >
                                    <option value="npc">NPC</option>
                                    <option value="task">任务</option>
                                </select>
                                <span className={`${styles.selectArrow} ${isSelectOpen.obtainMethod ? styles.selectArrowOpen : ''}`}></span>
                            </div>
                        </label>
                    </div>

                    {/* 物品获取途径描述 */}
                    <div className={styles.formGroup}>
                        <label>
                            <span>物品获取途径描述 <span className={sharedStyles.required}>*</span></span>
                            <textarea
                                rows={4}
                                value={formData.acquisition?.condition || ''}
                                onChange={(e) => handleFieldChange('acquisition.condition', e.target.value)}
                                placeholder="详细的获取途径描述。可以规定何时何地何种情况/剧情下才能获得该物品，是给大模型用的提示词输入。"
                            />
                        </label>
                    </div>

                    {/* 物品其他描述（可选） */}
                    <div className={styles.formGroup}>
                        <label>
                            <span>物品其他描述（可选）</span>
                            <textarea
                                rows={3}
                                value={formData.otherNotes || ''}
                                onChange={(e) => handleFieldChange('otherNotes', e.target.value)}
                                placeholder="其他和该物品相关的描述"
                            />
                        </label>
                    </div>

                    {/* 保存按钮 */}
                    <div className={styles.formActionsBottom}>
                        <button
                            type="button"
                            className={sharedStyles.primary}
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? '保存中...' : '保存'}
                        </button>
                    </div>
                </div>
            </div>

            {/* AI生成图片积分确认弹窗 */}
            <ConfirmModal
                isOpen={generateModalOpen}
                onConfirm={handleConfirmGenerateImage}
                onCancel={handleCancelGenerateImage}
                title="积分扣除确认"
                message={`本次生成图片将扣除 ${IMAGE_GENERATION_COST} 积分，是否继续？`}
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />
        </div>
    );
});

ObjectDetail.displayName = 'ObjectDetail';

export default ObjectDetail;

