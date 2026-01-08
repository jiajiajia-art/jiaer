import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChromePicker } from 'react-color';
import type { ColorResult } from 'react-color';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
    color: string;
    onChange: (color: string) => void;
}

// 将任意 rgba(...) / hex 字符串转成标准的 #RRGGBB
const toHexString = (color: string): string => {
    const rgbaMatch = color.match(/rgba?\(([^)]+)\)/);
    if (rgbaMatch) {
        const parts = rgbaMatch[1].split(',').map(p => parseFloat(p.trim()));
        const [r = 224, g = 61, b = 75] = parts;
        const toHex = (v: number) => v.toString(16).padStart(2, '0');
        return `#${toHex(Math.round(r))}${toHex(Math.round(g))}${toHex(Math.round(b))}`;
    }

    const rawHex = color.replace('#', '');
    if (rawHex.length === 3) {
        const full = rawHex.split('').map(c => c + c).join('');
        return `#${full.toLowerCase()}`;
    }
    if (rawHex.length === 6) {
        return `#${rawHex.toLowerCase()}`;
    }

    return '#e03d4b';
};

const isValidHex = (value: string): boolean => {
    return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value.trim());
};

const hexToRgbaString = (value: string): string => {
    const raw = value.replace('#', '');
    let hex = raw;
    if (raw.length === 3) {
        hex = raw.split('').map(c => c + c).join('');
    }
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, 1)`;
};

const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [internalColor, setInternalColor] = useState<string>(color || '#E03D4B');
    const [hexInput, setHexInput] = useState<string>(toHexString(color || '#E03D4B'));
    const [isEditing, setIsEditing] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isEditing) {
            const next = color || '#E03D4B';
            setInternalColor(next);
            setHexInput(toHexString(next));
        }
    }, [color, isEditing]);

    // 点击组件外部关闭调色盘
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            // 如果点击的是输入框，不关闭调色盘
            if (inputRef.current && (inputRef.current === target || inputRef.current.contains(target))) {
                return;
            }
            if (pickerRef.current && !pickerRef.current.contains(target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // 将字符串颜色解析为 {r,g,b,a}，供 ChromePicker 使用
    const rgbaColor = useMemo(() => {
        const rgbaMatch = internalColor.match(/rgba?\(([^)]+)\)/);
        if (rgbaMatch) {
            const parts = rgbaMatch[1].split(',').map(p => parseFloat(p.trim()));
            const [r = 255, g = 61, b = 75, a = 1] = parts;
            return { r, g, b, a: isNaN(a) ? 1 : a };
        }
        // hex 转换
        const hex = internalColor.replace('#', '');
        if (hex.length === 3 || hex.length === 6) {
            const bigint = parseInt(hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex, 16);
            return {
                r: (bigint >> 16) & 255,
                g: (bigint >> 8) & 255,
                b: bigint & 255,
                a: 1,
            };
        }
        return { r: 224, g: 61, b: 75, a: 1 };
    }, [internalColor]);

    // 选色后转成 rgba(...) 字符串回传
    const handleChange = (result: ColorResult) => {
        const { r, g, b, a } = result.rgb;
        const next = `rgba(${r}, ${g}, ${b}, ${typeof a === 'number' ? a : 1})`;
        setInternalColor(next);
        setHexInput(toHexString(next));
        onChange(next);
    };

    const applyHexInput = () => {
        const value = hexInput.trim();
        if (!isValidHex(value)) {
            // 无效输入时还原为当前颜色
            setHexInput(toHexString(internalColor));
            return;
        }
        const normalizedHex = value.startsWith('#') ? value : `#${value}`;
        const rgba = hexToRgbaString(normalizedHex);
        setInternalColor(rgba);
        setHexInput(toHexString(rgba));
        onChange(rgba);
    };

    const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setHexInput(e.target.value);
        setIsEditing(true);
    };

    const handleHexInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            applyHexInput();
            setIsEditing(false);
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            // 取消编辑，恢复原值
            setHexInput(toHexString(internalColor));
            setIsEditing(false);
            e.currentTarget.blur();
        }
    };

    const handleHexInputFocus = () => {
        setIsEditing(true);
        if (inputRef.current) {
            inputRef.current.select();
        }
    };

    const handleHexInputBlur = () => {
        applyHexInput();
        setIsEditing(false);
    };

    return (
        <div className={styles.colorPicker} ref={pickerRef}>
            <div className={styles.colorButton}>
                <div
                    className={styles.colorPreview}
                    style={{ backgroundColor: internalColor }}
                    onClick={() => setIsOpen(!isOpen)}
                    title="选择颜色"
                />
                <input
                    ref={inputRef}
                    className={styles.colorLabelInput}
                    value={hexInput}
                    onChange={handleHexInputChange}
                    onBlur={handleHexInputBlur}
                    onKeyDown={handleHexInputKeyDown}
                    onFocus={handleHexInputFocus}
                    onClick={(e) => {
                        // 阻止事件冒泡
                        e.stopPropagation();
                        // 确保输入框获得焦点
                        const input = e.currentTarget;
                        if (document.activeElement !== input) {
                            input.focus();
                        }
                    }}
                    onMouseDown={(e) => {
                        // 阻止事件冒泡，避免被父元素拦截
                        e.stopPropagation();
        
                        // 使用 requestAnimationFrame 确保在下一个渲染周期设置焦点
                        requestAnimationFrame(() => {
                            const input = inputRef.current;
                            if (input && document.activeElement !== input) {
                                input.focus();
                                // 再次检查并选中文本
                                requestAnimationFrame(() => {
                                    if (input === document.activeElement) {
                                        input.select();
                                    }
                                });
                            }
                        });
                    }}
                    placeholder="#FFFFFF"
                    type="text"
                    readOnly={false}
                    disabled={false}
                    tabIndex={0}
                    autoComplete="off"
                />
            </div>

            {isOpen && (
                <div className={styles.colorPanel}>
                    <ChromePicker
                        color={rgbaColor}
                        onChange={handleChange}
                        disableAlpha={false}
                    />
                </div>
            )}
        </div>
    );
};

export default ColorPicker;

