import React, { useEffect, useState } from 'react';
import { MdCheck } from 'react-icons/md';
import styles from './InlineFieldSave.module.css';

type InlineFieldSaveVariant = 'field' | 'group';
type InlineFieldSaveButtonPlacement = 'overlay' | 'external';

interface InlineFieldSaveProps {
    children: React.ReactNode;
    showSave: boolean;
    onSave: () => void | boolean | Promise<void> | Promise<boolean>;
    disabled?: boolean;
    variant?: InlineFieldSaveVariant;
    buttonPlacement?: InlineFieldSaveButtonPlacement;
    className?: string;
    inputClassName?: string;
    buttonClassName?: string;
}

const InlineFieldSave: React.FC<InlineFieldSaveProps> = ({
    children,
    showSave,
    onSave,
    disabled = false,
    variant = 'field',
    buttonPlacement = 'overlay',
    className = '',
    inputClassName = '',
    buttonClassName = '',
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!showSave) {
            setIsSubmitting(false);
        }
    }, [showSave]);

    const content =
        variant === 'field'
        && buttonPlacement === 'overlay'
        && React.isValidElement<{ className?: string }>(children)
            ? React.cloneElement(children, {
                // 功能注释：只在出现保存钮时留右侧内边距，避免未改字段右侧空一截
                className: [
                    children.props.className,
                    showSave ? styles.fieldControl : '',
                    inputClassName,
                ].filter(Boolean).join(' '),
            })
            : children;

    const wrapperClassName = [
        styles.wrapper,
        variant === 'group' ? styles.groupWrapper : styles.fieldWrapper,
        showSave && variant === 'group' ? styles.groupWrapperDirty : '',
        buttonPlacement === 'external' ? styles.externalWrapper : '',
        className,
    ].filter(Boolean).join(' ');

    const saveButtonClassName = [
        styles.saveButton,
        variant === 'group' ? styles.groupSaveButton : '',
        buttonPlacement === 'external' ? styles.externalSaveButton : '',
        buttonClassName,
    ].filter(Boolean).join(' ');

    const shouldShowSave = showSave;

    const handleSaveClick = async () => {
        if (disabled || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await onSave();
            if (result === false) {
                setIsSubmitting(false);
            }
        } catch (error) {
            setIsSubmitting(false);
            throw error;
        }
    };

    return (
        <div className={wrapperClassName}>
            {content}
            {shouldShowSave ? (
                buttonPlacement === 'external' ? (
                    <div className={styles.externalSaveRow}>
                        <button
                            type="button"
                            className={saveButtonClassName}
                            onClick={() => {
                                void handleSaveClick();
                            }}
                            disabled={disabled || isSubmitting}
                            aria-label="Save changes"
                            title="Save changes"
                        >
                            <MdCheck size={18} />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        className={saveButtonClassName}
                        onClick={() => {
                            void handleSaveClick();
                        }}
                        disabled={disabled || isSubmitting}
                        aria-label="Save changes"
                        title="Save changes"
                    >
                        <MdCheck size={18} />
                    </button>
                )
            ) : null}
        </div>
    );
};

export default InlineFieldSave;
