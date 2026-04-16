import React, { useState, useRef, useEffect, useImperativeHandle } from 'react';
import styles from './ObjectDetail.module.css';
import sharedStyles from './shared.module.css';
import ConfirmModal from '../../CommonModal/ConfirmModal';
import ImageCropModal from '../../CommonModal/ImageCropModal';
import { toast } from 'react-hot-toast';
import { getImageUrl, CHARACTER_GENERATION_COST, normalizeIcon as normalizeIconUtil } from '../../../utils/constants';
import { addImageTimestamp } from '../../../utils/imageCache';
import type { ObjectItem } from '../../../api/worldInteraction/objectsData.type';
import { objectsData } from '../../../api/worldInteraction/objectsData';
import { useImageCropper } from '../../../hooks/useImageCropper';
import { MAX_UPLOAD_IMAGE_SIZE } from '../../../utils/uploadImageCrop';

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
    // formData 中的 acquisition.source 使用 UI 显示值 (npc/task)
    // 保存时会转换为后端值 (ability_node/task)
    type FormDataAcquisition = {
        source: 'npc' | 'task'; // UI 显示值
        condition: string;
    };
    
    const [formData, setFormData] = useState<Omit<Partial<ObjectItem>, 'acquisition'> & {
        acquisition?: FormDataAcquisition;
    }>({
        item_id: '',
        name: '新建物品',
        category: 'consumable',
        stackable: false,
        icon: '',
        description: '',
        functionalDescription: '',
        acquisition: {
            source: 'npc', // UI 显示值，保存时会转换为 ability_node
            condition: '',
        },
        otherNotes: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingId, setIsGeneratingId] = useState<string | null>(null);
    const [isSelectOpen, setIsSelectOpen] = useState<{ [key: string]: boolean }>({});
    const [generateModalOpen, setGenerateModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [localFile, setLocalFile] = useState<File | null>(null);
    const [tempImageId, setTempImageId] = useState<string | null>(null);

    const {
        cropPreset,
        pendingCropFile,
        openCropper,
        closeCropper,
        handleCropComplete,
    } = useImageCropper({
        preset: 'objectIcon',
        onCropped: async (croppedFile) => {
            setLocalFile(croppedFile);
            setTempImageId(null);
            setFormData(prev => ({ ...prev, icon: URL.createObjectURL(croppedFile) }));
            toast.success('Image selected.');
        },
    });

    // 获取当前物品的唯一标识
    const getCurrentItemId = React.useCallback(() => {
        return object?.item_id || formData.item_id || (isNewObjectProp ? 'new' : null);
    }, [object?.item_id, formData.item_id, isNewObjectProp]);

    // 判断当前面板是否正在生成图片
    const isCurrentPanelGenerating = React.useMemo(() => {
        const currentItemId = getCurrentItemId();
        return currentItemId !== null && isGeneratingId !== null && isGeneratingId === currentItemId;
    }, [isGeneratingId, getCurrentItemId]);

    // 保存原始数据，用于比较是否有修改
    const originalObjectRef = React.useRef<ObjectItem | null>(null);
    // 标记是否正在初始化（避免初始化期间触发未保存检查）
    const isInitializingRef = React.useRef<boolean>(false);

    // 规范化 acquisition 数据（统一处理字符串和对象格式）
    const normalizeAcquisition = React.useCallback((acquisition: any) => {
        if (typeof acquisition === 'string') {
            try {
                return JSON.parse(acquisition);
            } catch (e) {
                return { source: 'ability_node', condition: '' };
            }
        }
        if (acquisition && typeof acquisition === 'object') {
            return acquisition;
        }
        return { source: 'ability_node', condition: '' };
    }, []);

    // 使用共享的 normalizeIcon 工具函数
    const normalizeIcon = React.useCallback((icon: any): string => {
        return normalizeIconUtil(icon);
    }, []);

    // 将后端 source 值转换为 UI 显示值
    const backendSourceToUI = React.useCallback((source: string): 'npc' | 'task' => {
        return source === 'ability_node' ? 'npc' : (source === 'task' ? 'task' : 'npc');
    }, []);

    // 将 UI source 值转换为后端值
    const uiSourceToBackend = React.useCallback((source: 'npc' | 'task'): string => {
        return source === 'npc' ? 'ability_node' : source;
    }, []);

    // 初始化表单数据
    const initializeFormData = React.useCallback((obj: ObjectItem | null) => {
        isInitializingRef.current = true;

        console.log('[ObjectDetail] 初始化表单数据', {
            itemId: obj?.item_id,
            isNewObject: isNewObjectProp,
            rawObject: obj,
        });

        if (obj) {
            // 规范化数据
            const parsedAcquisition = normalizeAcquisition(obj.acquisition);
            const normalizedIcon = normalizeIcon(obj.icon);
            const displaySource = backendSourceToUI(parsedAcquisition.source || 'ability_node');

            const normalizedObject: ObjectItem = {
                ...obj,
                stackable: typeof obj.stackable === 'string' 
                    ? obj.stackable === 'true' 
                    : Boolean(obj.stackable),
                icon: normalizedIcon,
                acquisition: parsedAcquisition,
            };

            // 保存原始对象（深拷贝，使用后端值）
            originalObjectRef.current = JSON.parse(JSON.stringify(normalizedObject));
            
            console.log('[ObjectDetail] 保存原始对象引用', {
                itemId: normalizedObject.item_id,
                originalIcon: originalObjectRef.current?.icon,
                originalName: originalObjectRef.current?.name,
                originalAcquisition: originalObjectRef.current?.acquisition,
            });

            // 更新表单数据（使用 UI 显示值）
            const newFormData: Omit<Partial<ObjectItem>, 'acquisition'> & {
                acquisition?: FormDataAcquisition;
            } = {
                item_id: normalizedObject.item_id || '',
                name: normalizedObject.name || '新建物品',
                category: (normalizedObject.category || 'consumable') as 'consumable' | 'non-consumable',
                stackable: normalizedObject.stackable,
                icon: normalizedIcon,
                description: normalizedObject.description || '',
                functionalDescription: normalizedObject.functionalDescription || '',
                acquisition: {
                    source: displaySource,
                    condition: parsedAcquisition.condition || '',
                },
                otherNotes: normalizedObject.otherNotes || '',
            };
            setFormData(newFormData);
            
            console.log('[ObjectDetail] 设置表单数据', {
                itemId: newFormData.item_id,
                formDataIcon: newFormData.icon,
                formDataName: newFormData.name,
                formDataAcquisition: newFormData.acquisition,
            });
        } else {
            // 新建物品
            originalObjectRef.current = null;
            const newFormData: Omit<Partial<ObjectItem>, 'acquisition'> & {
                acquisition?: FormDataAcquisition;
            } = {
                item_id: '',
                name: '新建物品',
                category: 'consumable' as 'consumable' | 'non-consumable',
                stackable: false,
                icon: '',
                description: '',
                functionalDescription: '',
                acquisition: {
                    source: 'npc',
                    condition: '',
                },
                otherNotes: '',
            };
            setFormData(newFormData);
            
            console.log('[ObjectDetail] 初始化新建物品表单', {
                formData: newFormData,
            });
        }

        // 清空临时状态
        setLocalFile(null);
        setTempImageId(null);
        // 不重置 isGeneratingId，保持生成状态（即使切换了物品，也能知道哪个物品正在生成）
        setGenerateModalOpen(false);

        // 延迟结束初始化，确保状态已更新
        setTimeout(() => {
            isInitializingRef.current = false;
            if (onHasUnsavedChanges) {
                onHasUnsavedChanges(false);
            }
            console.log('[ObjectDetail] 初始化完成', {
                itemId: obj?.item_id || 'new',
                hasOriginalObject: !!originalObjectRef.current,
            });
        }, 0);
    }, [normalizeAcquisition, normalizeIcon, backendSourceToUI, onHasUnsavedChanges]);

    // 当 object 变化时，更新表单数据
    useEffect(() => {
        const newObjectId = object?.item_id;
        const oldObjectId = originalObjectRef.current?.item_id;
        
        console.log('[ObjectDetail] object prop 变化', {
            newObjectId,
            oldObjectId,
            isSaving,
            isNewObject: isNewObjectProp,
            objectChanged: newObjectId !== oldObjectId,
        });
        
        // 如果正在保存中，跳过初始化，避免覆盖保存过程中的状态更新
        if (isSaving) {
            console.log('[ObjectDetail] 跳过初始化: 正在保存中');
            return;
        }
        
        // 如果对象 ID 相同，且已经有原始对象引用，检查是否需要重新初始化
        // 只有当对象真正变化时才重新初始化
        if (newObjectId && newObjectId === oldObjectId && originalObjectRef.current) {
            // 比较对象的关键字段，判断是否真的变化了
            const currentIcon = normalizeIcon(object?.icon);
            const originalIcon = normalizeIcon(originalObjectRef.current.icon);
            const iconChanged = currentIcon !== originalIcon;
            const nameChanged = object?.name !== originalObjectRef.current.name;
            
            if (!iconChanged && !nameChanged) {
                console.log('[ObjectDetail] 跳过初始化: 对象 ID 相同且关键字段未变化', {
                    newObjectId,
                    iconChanged,
                    nameChanged,
                });
                return;
            } else {
                console.log('[ObjectDetail] 对象 ID 相同但内容有变化，需要重新初始化', {
                    iconChanged,
                    nameChanged,
                });
            }
        }
        
        initializeFormData(object);
    }, [object, isSaving, initializeFormData, isNewObjectProp, normalizeIcon]);

    // 检测图片是否发生变化
    const checkImageChanged = React.useCallback((): boolean => {
        // 如果有新的图片上传/生成，肯定有变化
        if (localFile !== null || tempImageId !== null) {
            console.log('[ObjectDetail] 图片变化检测: 有新的上传/生成', {
                hasLocalFile: localFile !== null,
                hasTempImageId: tempImageId !== null,
            });
            return true;
        }

        // 如果没有原始数据，检查是否有图片
        if (!object || !originalObjectRef.current) {
            const hasImage = !!(formData.icon || localFile || tempImageId);
            console.log('[ObjectDetail] 图片变化检测: 新建物品', {
                hasImage,
                formDataIcon: formData.icon,
            });
            return hasImage;
        }

        const original = originalObjectRef.current;
        const originalIcon = normalizeIcon(original.icon);
        const currentIcon = formData.icon || '';

        // 如果当前是 blob URL 而原始不是，说明有新上传的图片
        const isBlobUrl = currentIcon.startsWith('blob:');
        const originalIsBlobUrl = originalIcon.startsWith('blob:');
        
        if (isBlobUrl && !originalIsBlobUrl) {
            console.log('[ObjectDetail] 图片变化检测: blob URL 变化', {
                currentIcon,
                originalIcon,
            });
            return true;
        }

        // 比较图标路径（排除 blob URL 的情况）
        if (!isBlobUrl && !originalIsBlobUrl) {
            const changed = currentIcon !== originalIcon;
            if (changed) {
                console.log('[ObjectDetail] 图片变化检测: 图标路径不同', {
                    currentIcon,
                    originalIcon,
                });
            }
            return changed;
        }

        console.log('[ObjectDetail] 图片变化检测: 无变化', {
            currentIcon,
            originalIcon,
        });
        return false;
    }, [object, formData.icon, localFile, tempImageId, normalizeIcon]);

    // 检测表单字段是否发生变化（不包括图片）
    const checkFormFieldsChanged = React.useCallback((): boolean => {
        // 新建物品：检查是否有任何内容（除了默认值）
        if (!object || !originalObjectRef.current) {
            if (isNewObjectProp) {
                const hasChanges = !!(
                    formData.name?.trim() !== '新建物品' ||
                    formData.description?.trim() ||
                    formData.functionalDescription?.trim() ||
                    (formData.acquisition?.source && formData.acquisition.source !== 'npc') ||
                    (formData.acquisition?.condition && formData.acquisition.condition !== '') ||
                    formData.otherNotes?.trim()
                );
                console.log('[ObjectDetail] 表单字段变化检测: 新建物品', {
                    hasChanges,
                    name: formData.name,
                    description: formData.description,
                    functionalDescription: formData.functionalDescription,
                    acquisition: formData.acquisition,
                    otherNotes: formData.otherNotes,
                });
                return hasChanges;
            }
            console.log('[ObjectDetail] 表单字段变化检测: 无原始对象，返回 false');
            return false;
        }

        const original = originalObjectRef.current;
        const originalAcquisition = normalizeAcquisition(original.acquisition);
        
        // 将 UI 值转换为后端值进行比较
        const formDataSource = uiSourceToBackend(formData.acquisition?.source || 'npc');
        const originalSource = originalAcquisition.source || 'ability_node';

        const changes = {
            name: formData.name !== (original.name || ''),
            category: formData.category !== (original.category || 'consumable'),
            stackable: formData.stackable !== original.stackable,
            description: formData.description !== (original.description || ''),
            functionalDescription: formData.functionalDescription !== (original.functionalDescription || ''),
            acquisitionSource: formDataSource !== originalSource,
            acquisitionCondition: formData.acquisition?.condition !== (originalAcquisition.condition || ''),
            otherNotes: formData.otherNotes !== (original.otherNotes || ''),
        };

        const hasChanges = Object.values(changes).some(Boolean);
        
        if (hasChanges) {
            console.log('[ObjectDetail] 表单字段变化检测: 有变化', {
                itemId: original.item_id,
                changes,
                formData: {
                    name: formData.name,
                    category: formData.category,
                    stackable: formData.stackable,
                    description: formData.description,
                    functionalDescription: formData.functionalDescription,
                    acquisitionSource: formDataSource,
                    acquisitionCondition: formData.acquisition?.condition,
                    otherNotes: formData.otherNotes,
                },
                original: {
                    name: original.name,
                    category: original.category,
                    stackable: original.stackable,
                    description: original.description,
                    functionalDescription: original.functionalDescription,
                    acquisitionSource: originalSource,
                    acquisitionCondition: originalAcquisition.condition,
                    otherNotes: original.otherNotes,
                },
            });
        }

        return hasChanges;
    }, [object, formData, isNewObjectProp, normalizeAcquisition, uiSourceToBackend]);

    // 检测是否只修改了图片（没有修改表单字段）
    const checkOnlyImageChanged = React.useCallback((): boolean => {
        // 如果表单字段有变化，肯定不是只修改了图片
        if (checkFormFieldsChanged()) {
            return false;
        }
        // 如果图片有变化，且表单字段没变化，说明只修改了图片
        return checkImageChanged();
    }, [checkImageChanged, checkFormFieldsChanged]);

    // 检测是否有未保存的修改（图片或表单字段任一有变化）
    const checkUnsavedChanges = React.useCallback((): boolean => {
        const imageChanged = checkImageChanged();
        const formFieldsChanged = checkFormFieldsChanged();
        const hasChanges = imageChanged || formFieldsChanged;
        
        console.log('[ObjectDetail] checkUnsavedChanges 汇总', {
            itemId: object?.item_id || formData.item_id || 'new',
            imageChanged,
            formFieldsChanged,
            hasChanges,
            hasOriginalObject: !!originalObjectRef.current,
        });
        
        return hasChanges;
    }, [checkImageChanged, checkFormFieldsChanged, object?.item_id, formData.item_id]);

    // 当表单数据变化时，通知父组件是否有未保存的修改
    useEffect(() => {
        // 初始化期间不触发检测，避免误报
        if (isInitializingRef.current) {
            console.log('[ObjectDetail] 跳过未保存检测: 正在初始化');
            return;
        }
        
        // 如果没有原始对象（新建物品且未保存），不触发检测
        if (!originalObjectRef.current && !isNewObjectProp) {
            console.log('[ObjectDetail] 跳过未保存检测: 无原始对象且非新建物品');
            return;
        }
        
        // 通知父组件当前是否有未保存的修改
        if (onHasUnsavedChanges) {
            const hasChanges = checkUnsavedChanges();
            console.log('[ObjectDetail] 检测未保存修改', {
                itemId: object?.item_id || formData.item_id || 'new',
                hasChanges,
                isInitializing: isInitializingRef.current,
                hasOriginalObject: !!originalObjectRef.current,
            });
            onHasUnsavedChanges(hasChanges);
        }
    }, [formData, localFile, tempImageId, checkUnsavedChanges, onHasUnsavedChanges, object?.item_id, isNewObjectProp]);

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

    const handleFileChangeForCrop = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file.');
            return;
        }

        if (file.size > MAX_UPLOAD_IMAGE_SIZE) {
            toast.error('Image size must be under 5MB.');
            return;
        }

        void openCropper(file).catch((error) => {
            console.error('open object cropper failed:', error);
            toast.error('Failed to load image.');
        });
    };
    void handleFileChange;

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
        
        // 记录当前物品的 ID，用于标识正在生成的是哪个物品
        const currentItemId = getCurrentItemId();
        if (!currentItemId) {
            toast.error('无法识别当前物品');
            return;
        }
        
        // 设置生成状态，使用 ID 标识
        setIsGeneratingId(currentItemId);
        setGenerateModalOpen(false);
        try {
            const response = await objectsData.generateObjectImage(fileId, formData.description || '');
            if (response.data?.success) {
                // 检查是否仍然是同一个物品（用户可能已经切换了物品）
                const stillCurrentItem = getCurrentItemId() === currentItemId;
                if (stillCurrentItem) {
                    setTempImageId(response.data.tempImageId);
                    setFormData(prev => ({ ...prev, icon: response.data.url }));
                    setLocalFile(null);
                    toast.success('图片生成成功');
                }
                // 如果用户已经切换了物品，不更新当前表单（静默处理，避免干扰用户）
            } else {
                toast.error('图片生成失败');
            }
        } catch (error: any) {
            console.error('生成图片失败:', error);
            toast.error('图片生成失败：' + (error.message || '请检查网络连接'));
        } finally {
            // 只有当前物品的生成完成时才清除生成状态
            const stillCurrentItem = getCurrentItemId() === currentItemId;
            if (stillCurrentItem) {
                setIsGeneratingId(null);
            }
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
            
            // acquisition 字段作为完整的 JSON 对象传递
            // UI 中的 npc 需要转换为后端的 ability_node，task 保持不变
            const uiSource = formData.acquisition?.source || 'npc';
            const backendSource = uiSource === 'npc' ? 'ability_node' : uiSource;
            
            const acquisitionData = {
                source: backendSource,
                condition: formData.acquisition?.condition || '',
            };
            formDataToSend.append('acquisition', JSON.stringify(acquisitionData));
            
            formDataToSend.append('otherNotes', formData.otherNotes || '');
            
            // 图片处理：优先使用本地上传的文件
            if (localFile) {
                formDataToSend.append('image', localFile);
            } 
            // 如果有 AI 生成的图片，使用 tempImageId
            else if (tempImageId) {
                formDataToSend.append('tempImageId', tempImageId);
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
            
            // 规范化保存后的对象数据
            const savedIcon = normalizeIcon(savedObject.icon);
            // 如果上传失败且当前有 blob URL，保留 blob URL
            const finalIcon = savedIcon || (formData.icon?.startsWith('blob:') ? formData.icon : '');
            const normalizedAcquisition = normalizeAcquisition(savedObject.acquisition);
            
            // 构建规范化后的 savedObject
            const normalizedSavedObject: ObjectItem = {
                ...savedObject,
                icon: finalIcon,
                acquisition: normalizedAcquisition,
                stackable: typeof savedObject.stackable === 'string' 
                    ? savedObject.stackable === 'true' 
                    : Boolean(savedObject.stackable),
            };
            
            // 更新原始对象引用（深拷贝），用于后续比较
            originalObjectRef.current = JSON.parse(JSON.stringify(normalizedSavedObject));
            
            // 清空临时文件状态
            setLocalFile(null);
            setTempImageId(null);
            
            // 先清除未保存状态，避免在 onSave 过程中触发检查
            if (onHasUnsavedChanges) {
                onHasUnsavedChanges(false);
            }
            
            // 调用 onSave，传递规范化后的对象
            await onSave(normalizedSavedObject);
            
            // 等待父组件状态更新完成，然后重新初始化表单数据
            // 这样可以确保 formData 和 originalObjectRef 与最新的 object prop 同步
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 重新初始化表单数据，确保状态一致
            // 注意：这里不直接调用 initializeFormData，而是依赖 useEffect 自动处理
            // 因为 object prop 会通过父组件更新，useEffect 会自动触发
            
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
                                        disabled={isCurrentPanelGenerating}
                                    >
                                        {isCurrentPanelGenerating ? '生成中...' : `${CHARACTER_GENERATION_COST} 积分 AI生成`}
                                    </button>
                                </div>
                                <div className={styles.imagePreviewSection}>
                                    <div className={styles.imagePreviewWrapper}>
                                        {formData.icon && typeof formData.icon === 'string' && formData.icon.trim() ? (
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
                                        {isCurrentPanelGenerating && (
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
                                        disabled={isCurrentPanelGenerating}
                                    >
                                        上传图片
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChangeForCrop}
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
                message={`本次生成图片将扣除 ${CHARACTER_GENERATION_COST} 积分，是否继续？`}
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />
            {pendingCropFile ? (
                <ImageCropModal
                    isOpen
                    imageSrc={pendingCropFile.imageSrc}
                    title={cropPreset.title}
                    description={cropPreset.description}
                    aspectRatio={cropPreset.aspectRatio}
                    aspectLabel={cropPreset.aspectLabel}
                    defaultCropScale={cropPreset.defaultCropScale}
                    mimeType={pendingCropFile.mimeType}
                    onClose={closeCropper}
                    onCropComplete={handleCropComplete}
                />
            ) : null}
        </div>
    );
});

ObjectDetail.displayName = 'ObjectDetail';

export default ObjectDetail;
