import React from 'react';
import styles from './MapModal.module.css';
import { HOST_ADDRESS } from '../../config';

type Positions = Record<string, { x: number; y: number }>;

interface MapModalProps {
    isOpen: boolean;
    onClose: () => void;
    scenes: Record<string, any>;
    positions: Positions;
    currentSceneId?: string | null;
    onSceneClick?: (sceneId: string) => void;
}

const MapModal: React.FC<MapModalProps> = ({
    isOpen,
    onClose,
    scenes,
    positions,
    currentSceneId,
    onSceneClick
}) => {
    if (!isOpen) return null;
    console.log('scenes', scenes);
    
    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>大地图</h2>
                    <div className={styles.actions}>
                        <button className={styles.closeBtn} onClick={onClose}>×</button>
                    </div>
                </div>
                <div className={styles.content}>
                    <div className={styles.mapContainer}>
                        <svg className={styles.mapSvg} viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid meet">
                            <g>
                                {Object.entries(scenes).map(([id, sc]) => (
                                    sc.exits
                                        ? Object.entries(sc.exits).map(([_, targetId]) =>
                                            typeof targetId === "string" &&
                                                positions[id] &&
                                                positions[targetId] ? (
                                                <line
                                                    key={`${id}-${targetId}`}
                                                    x1={positions[id].x}
                                                    y1={positions[id].y}
                                                    x2={positions[targetId].x}
                                                    y2={positions[targetId].y}
                                                    stroke="#9aa6b2"
                                                    strokeWidth={4}
                                                    strokeDasharray="8,8"
                                                />
                                            ) : null)
                                        : null))
                                }
                            </g>
                            <g>
                                {Object.entries(scenes).map(([id, sc]) => (
                                    positions[id] ? (
                                        <g
                                            key={id}
                                            onClick={() => onSceneClick && onSceneClick(id)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <defs>
                                                <clipPath id={`clip-${id}`}>
                                                    <circle cx={positions[id].x} cy={positions[id].y} r={id === currentSceneId ? 90 : 80} />
                                                </clipPath>
                                            </defs>
                                            <image
                                                href={`${HOST_ADDRESS}${sc.background}` || '/data/icons/empty.png'}
                                                x={positions[id].x - (id === currentSceneId ? 90 : 80)}
                                                y={positions[id].y - (id === currentSceneId ? 90 : 80)}
                                                width={(id === currentSceneId ? 180 : 160)}
                                                height={(id === currentSceneId ? 180 : 160)}
                                                clipPath={`url(#clip-${id})`}
                                                preserveAspectRatio="xMidYMid slice"
                                            />
                                            <circle
                                                cx={positions[id].x}
                                                cy={positions[id].y}
                                                r={id === currentSceneId ? 90 : 80}
                                                fill="none"
                                                stroke={id === currentSceneId ? '#e74c3c' : '#4a90e2'}
                                                strokeWidth={id === currentSceneId ? 6 : 5}
                                            />
                                            <text
                                                x={positions[id].x}
                                                y={positions[id].y + 12}
                                                textAnchor="middle"
                                                fill="#29323c"
                                                fontSize={36}
                                                fontWeight="bold"
                                            >
                                                {sc.name.length > 6 ? sc.name.substring(0, 6) : sc.name}
                                            </text>
                                        </g>
                                    ) : null
                                ))}
                            </g>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MapModal;