import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChromePicker } from 'react-color';
import type { ColorResult } from 'react-color';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
    color: string;
    onChange: (color: string) => void;
}

// 将任意 rgba(...) / hex 字符串转成标准的 #RRGGBBAA（包含透明度）
const toHexString = (color: string): string => {
    const rgbaMatch = color.match(/rgba?\(([^)]+)\)/);
    if (rgbaMatch) {
        const parts = rgbaMatch[1].split(',').map(p => parseFloat(p.trim()));
        const [r = 55, g = 51, b = 52, a = 1] = parts;
        const toHex = (v: number) => v.toString(16).padStart(2, '0');
        const alpha = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
        const aByte = Math.round(alpha * 255);
        return `#${toHex(Math.round(r))}${toHex(Math.round(g))}${toHex(Math.round(b))}${toHex(aByte)}`;
    }

    const rawHex = color.replace('#', '');
    // 支持 3/4/6/8 位 hex，统一标准化为 8 位（RRGGBBAA）
    if (rawHex.length === 3 || rawHex.length === 4) {
        const full = rawHex.split('').map(c => c + c).join('');
        const rgb = full.slice(0, 6);
        const alpha = full.length === 8 ? full.slice(6, 8) : 'ff';
        return `#${(rgb + alpha).toLowerCase()}`;
    }
    if (rawHex.length === 6) {
        return `#${(rawHex + 'ff').toLowerCase()}`;
    }
    if (rawHex.length === 8) {
        return `#${rawHex.toLowerCase()}`;
    }

    return '#37333480';
};

const isValidHex = (value: string): boolean => {
    return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value.trim());
};

const hexToRgbaString = (value: string): string => {
    const raw = value.replace('#', '');
    let hex = raw;
    let r = 55, g = 51, b = 52, aByte = 255;

    if (raw.length === 3 || raw.length === 4) {
        // #RGB / #RGBA
        const full = raw.split('').map(c => c + c).join('');
        hex = full;
    }

    if (hex.length === 6) {
        // 没有 alpha，默认不透明
        aByte = 255;
    } else if (hex.length === 8) {
        aByte = parseInt(hex.slice(6, 8), 16);
        hex = hex.slice(0, 6);
    }

    const bigint = parseInt(hex, 16);
    if (!Number.isNaN(bigint)) {
        r = (bigint >> 16) & 255;
        g = (bigint >> 8) & 255;
        b = bigint & 255;
    }
    const alpha = Math.max(0, Math.min(1, aByte / 255));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [internalColor, setInternalColor] = useState<string>(color || '#37333480');
    const [hexInput, setHexInput] = useState<string>(toHexString(color || '#37333480'));
    const [isEditing, setIsEditing] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isEditing) {
            const next = color || '#37333480';
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
            const [r = 55, g = 51, b = 52, a = 1] = parts;
            return { r, g, b, a: isNaN(a) ? 1 : a };
        }
        // hex 转换
        const hex = internalColor.replace('#', '');
        if (hex.length === 3 || hex.length === 4 || hex.length === 6 || hex.length === 8) {
            const normalized = toHexString(`#${hex}`); // 标准化为 8 位
            const clean = normalized.replace('#', '');
            const rgbHex = clean.slice(0, 6);
            const aHex = clean.slice(6, 8);
            const bigint = parseInt(rgbHex, 16);
            const aByte = parseInt(aHex, 16);
            return {
                r: (bigint >> 16) & 255,
                g: (bigint >> 8) & 255,
                b: bigint & 255,
                a: Number.isNaN(aByte) ? 1 : Math.max(0, Math.min(1, aByte / 255)),
            };
        }
        return { r: 55, g: 51, b: 52, a: 1 };
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

