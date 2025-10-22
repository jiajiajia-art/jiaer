import React, { useRef, useEffect, useState } from 'react';
import styles from './WorldMap.module.css';

interface SceneExit {
    name: string;
    direction: string;
    target: string;
    description?: string;
    // 其他可能的出口属性
}

interface Scene {
    id: string;
    name: string;
    description: string;
    background: string;
    exits: { [key: string]: string }; // {[direction]: sceneId}
    // 其他可能的场景属性
}

interface SceneDataCollection {
    [key: string]: Scene;
}

interface WorldMapProps {
    scenes: SceneDataCollection;
    currentSceneId: string;
    onSceneSelect: (scene: Scene) => void;
}

// 场景位置计算和优化逻辑
interface ScenePosition {
    x: number;
    y: number;
}

const calculateScenePositions = (scenes: SceneDataCollection): { [key: string]: ScenePosition } => {
    const positions: { [key: string]: ScenePosition } = {};
    const sceneIds = Object.keys(scenes);
    const gridSize = Math.ceil(Math.sqrt(sceneIds.length));
    const svgWidth = 1000;
    const svgHeight = 800;
    const cellWidth = svgWidth / (gridSize + 1);
    const cellHeight = svgHeight / (gridSize + 1);

    sceneIds.forEach((id, index) => {
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        positions[id] = {
            x: (col + 1) * cellWidth,
            y: (row + 1) * cellHeight
        };
    });

    optimizePositions(scenes, positions);
    return positions;
};

const optimizePositions = (scenes: SceneDataCollection, positions: { [key: string]: ScenePosition }) => {
    const directionOffsets: { [key: string]: { x: number; y: number } } = {
        north: { x: 0, y: -150 },
        south: { x: 0, y: 150 },
        east: { x: 150, y: 0 },
        west: { x: -150, y: 0 },
        northeast: { x: 120, y: -120 },
        northwest: { x: -120, y: -120 },
        southeast: { x: 120, y: 120 },
        southwest: { x: -120, y: 120 }
    };

    const visited = new Set<string>();
    const queue: string[] = [Object.keys(scenes)[0]];

    if (queue[0]) {
        positions[queue[0]] = { x: 500, y: 400 }; // 设置起始场景在中心
    }

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const scene = scenes[currentId];
        const currentPos = positions[currentId];

        if (scene && scene.exits) {
            Object.entries(scene.exits).forEach(([direction, targetId]) => {
                if (!visited.has(targetId) && scenes[targetId]) {
                    const offset = directionOffsets[direction] || { x: 100, y: 100 };
                    positions[targetId] = {
                        x: currentPos.x + offset.x,
                        y: currentPos.y + offset.y
                    };
                    queue.push(targetId);
                }
            });
        }
    }
};

const WorldMap: React.FC<WorldMapProps> = ({ scenes, currentSceneId, onSceneSelect }) => {
    const [positions, setPositions] = useState<{ [key: string]: ScenePosition }>({});
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (Object.keys(scenes).length > 0) {
            setPositions(calculateScenePositions(scenes));
        }
    }, [scenes]);

    const handleResetView = () => {
        // 重新计算位置以重置视图
        if (Object.keys(scenes).length > 0) {
            setPositions(calculateScenePositions(scenes));
        }
    };

    return (
        <div className={styles.mapContent}>
            <button className={styles.resetMapBtn} onClick={handleResetView}>重置视图</button>
            <svg ref={svgRef} className={styles.mapSvg} viewBox="0 0 1000 800">
                <g id="mapConnections">
                    {Object.entries(scenes).map(([sceneId, scene]) => {
                        if (!scene.exits || !positions[sceneId]) return null;
                        const startPos = positions[sceneId];
                        const drawnConnections = new Set<string>();

                        return Object.entries(scene.exits).map(([direction, targetId]) => {
                            const endPos = positions[targetId];
                            if (!endPos) return null;

                            const connectionKey = [sceneId, targetId].sort().join('-');
                            if (drawnConnections.has(connectionKey)) return null;
                            drawnConnections.add(connectionKey);

                            return (
                                <line
                                    key={connectionKey}
                                    className={styles.connectionLine}
                                    x1={startPos.x}
                                    y1={startPos.y}
                                    x2={endPos.x}
                                    y2={endPos.y}
                                />
                            );
                        });
                    })}
                </g>
                <g id="mapNodes">
                    {Object.entries(scenes).map(([sceneId, scene]) => {
                        const pos = positions[sceneId];
                        if (!pos) return null;

                        const isCurrent = sceneId === currentSceneId;
                        const radius = isCurrent ? 50 : 40;
                        const strokeColor = isCurrent ? '#e74c3c' : '#4a90e2';
                        const strokeWidth = isCurrent ? 4 : 3;
                        const clipId = `clip-${sceneId}`;

                        return (
                            <g
                                key={sceneId}
                                className={styles.sceneNode}
                                onClick={() => onSceneSelect(scene)}
                            >
                                <defs>
                                    <clipPath id={clipId}>
                                        <circle cx={pos.x} cy={pos.y} r={radius} />
                                    </clipPath>
                                </defs>
                                <image
                                    href={scene.background || 'data/icons/empty.png'}
                                    x={pos.x - radius}
                                    y={pos.y - radius}
                                    width={radius * 2}
                                    height={radius * 2}
                                    clipPath={`url(#${clipId})`}
                                    preserveAspectRatio="xMidYMid slice"
                                />
                                <circle
                                    className={styles.nodeCircle}
                                    cx={pos.x}
                                    cy={pos.y}
                                    r={radius}
                                    fill="none"
                                    stroke={strokeColor}
                                    strokeWidth={strokeWidth}
                                />
                                <circle
                                    cx={pos.x}
                                    cy={pos.y}
                                    r={radius}
                                    fill="rgba(0,0,0,0.4)"
                                />
                                <text className={styles.nodeText} x={pos.x} y={pos.y + 5}>
                                    {scene.name.length > 4 ? scene.name.substring(0, 4) : scene.name}
                                </text>
                                {isCurrent && (
                                    <text className={styles.nodeLabel} x={pos.x} y={pos.y + radius + 20} fill="#e74c3c" fontWeight="bold">
                                        ● 当前
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </g>
            </svg>
        </div>
    );
};

export default WorldMap;
