import React, { useState, useRef, useEffect, useCallback } from 'react';
import SaveConfirmModal from '../../components/CommonModal/SaveConfirmModal';
import { toast } from 'react-hot-toast';

export interface UnsavedChangesRef {
    checkBeforeLeave: (action?: () => void) => boolean;
}

interface UseUnsavedChangesOptions {
    /**
     * 保存方法，当用户选择保存时调用
     */
    onSave?: () => Promise<boolean | void>;
    /**
     * 是否启用未保存修改检测
     */
    enabled?: boolean;
}

interface UseUnsavedChangesReturn {
    /**
     * 是否有未保存的修改
     */
    hasUnsavedChanges: boolean;
    /**
     * 设置是否有未保存的修改
     */
    setHasUnsavedChanges: (hasChanges: boolean) => void;
    /**
     * 保存确认弹窗是否打开
     */
    saveConfirmModalOpen: boolean;
    /**
     * 待处理的操作
     */
    pendingAction: (() => void) | null;
    /**
     * 检查是否可以执行操作（如果有未保存修改，显示确认弹窗）
     */
    checkBeforeAction: (action: () => void) => boolean;
    /**
     * 保存确认弹窗组件
     */
    SaveConfirmModalComponent: React.ReactNode;
    /**
     * 获取 checkBeforeLeave 函数（用于 useImperativeHandle）
     */
    getCheckBeforeLeave: () => (action?: () => void) => boolean;
}

/**
 * 通用的未保存修改检测 Hook
 * 用于检测表单是否有未保存的修改，并在切换面板/关闭时提示用户
 */
export function useUnsavedChanges(
    options: UseUnsavedChangesOptions = {}
): UseUnsavedChangesReturn {
    const { onSave, enabled = true } = options;
    
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveConfirmModalOpen, setSaveConfirmModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
    const [isBlockingSwitch, setIsBlockingSwitch] = useState(false);
    
    // 使用 ref 来存储最新的状态值，避免闭包问题
    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
    const isBlockingSwitchRef = useRef(isBlockingSwitch);
    const pendingActionRef = useRef<(() => void) | null>(pendingAction);
    
    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    }, [hasUnsavedChanges]);
    
    useEffect(() => {
        isBlockingSwitchRef.current = isBlockingSwitch;
    }, [isBlockingSwitch]);

    useEffect(() => {
        pendingActionRef.current = pendingAction;
    }, [pendingAction]);

    const setPendingActionState = useCallback((action: (() => void) | null) => {
        pendingActionRef.current = action;
        setPendingAction(action ? () => action : null);
    }, []);

    const clearBlockingState = useCallback((clearUnsavedChanges: boolean) => {
        setSaveConfirmModalOpen(false);
        setIsBlockingSwitch(false);
        isBlockingSwitchRef.current = false;

        if (clearUnsavedChanges) {
            setHasUnsavedChanges(false);
            hasUnsavedChangesRef.current = false;
        }
    }, []);

    // 执行待处理的操作
    const executePendingAction = useCallback(() => {
        const action = pendingActionRef.current;
        setPendingActionState(null);

        if (action) {
            action();
        }
    }, [setPendingActionState]);

    // 检查是否可以执行操作（如果有未保存修改，显示确认弹窗）
    const checkBeforeAction = useCallback((action: () => void): boolean => {
        if (!enabled) {
            action();
            return true;
        }
        
        if (hasUnsavedChanges) {
            setPendingActionState(() => action);
            setSaveConfirmModalOpen(true);
            setIsBlockingSwitch(true);
            isBlockingSwitchRef.current = true;
            return false;
        }
        action();
        return true;
    }, [hasUnsavedChanges, enabled, setPendingActionState]);

    // 获取 checkBeforeLeave 函数（用于 useImperativeHandle）
    const getCheckBeforeLeave = useCallback(() => {
        return (action?: () => void) => {
            const hasChanges = hasUnsavedChangesRef.current;
            const isBlocking = isBlockingSwitchRef.current;
            
            if (hasChanges && !isBlocking && enabled) {
                // 实现保存后继续原操作
                if (action) {
                    setPendingActionState(() => action);
                } else {
                    setPendingActionState(null);
                }
                setSaveConfirmModalOpen(true);
                setIsBlockingSwitch(true);
                isBlockingSwitchRef.current = true;
                return false;
            }
            
            if (isBlocking) {
                return false;
            }
            
            return true;
        };
    }, [enabled, setPendingActionState]);

    // 保存确认弹窗组件
    const SaveConfirmModalComponent = React.createElement(SaveConfirmModal, {
        isOpen: saveConfirmModalOpen,
        onSave: async () => {
            if (onSave) {
                try {
                    const saveResult = await onSave();
                    if (saveResult === false) {
                        return;
                    }
                    clearBlockingState(true);
                    executePendingAction();
                } catch (error) {
                    toast.error('保存失败，请重试');
                    // 保存失败时不关闭弹窗，不执行待处理操作
                }
            } else {
                clearBlockingState(false);
                executePendingAction();
            }
        },
        onDiscard: () => {
            clearBlockingState(true);
            executePendingAction();
        },
        onCancel: () => {
            setSaveConfirmModalOpen(false);
            setIsBlockingSwitch(false);
            isBlockingSwitchRef.current = false;
            setPendingActionState(null);
        },
        title: "未保存的修改",
        message: "您有未保存的修改，是否要保存？",
        saveButtonText: "保存",
        discardButtonText: "不保存",
    });

    return {
        hasUnsavedChanges,
        setHasUnsavedChanges,
        saveConfirmModalOpen,
        pendingAction,
        checkBeforeAction,
        SaveConfirmModalComponent,
        getCheckBeforeLeave,
    };
}
