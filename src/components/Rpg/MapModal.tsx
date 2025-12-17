import React, { useMemo } from 'react';
import styles from './MapModal.module.css';
import { HOST_ADDRESS } from '../../config';
import { MdLockClock } from 'react-icons/md';

type ScenesMap = Record<string, any>;

interface MapModalProps {
    isOpen: boolean;
    onClose: () => void;
    scenes: ScenesMap;
    currentSceneId?: string | null;
    onSceneClick?: (sceneId: string) => void;
    worldMapImageUrl?: string | null;
    player?: {
        unlockedScenes?: string[];
    } | null;
}

// 地图布局：优化算法避免节点重合
const computePositions = (m: ScenesMap): Record<string, { x: number; y: number }> => {
    const ids = Object.keys(m);
    const positions: Record<string, { x: number; y: number }> = {};
    if (ids.length === 0) return positions;

    // 最小间距：根据节点数量动态调整
    // 节点少时使用更大的间距，让布局更舒适；节点多时适当减小以容纳更多节点
    const nodeCount = Object.keys(m).length;
    const MIN_DISTANCE = nodeCount > 20 ? 250 : (nodeCount > 15 ? 240 : 260); // 节点少时使用更大间距
    const BASE_OFFSET = nodeCount > 20 ? 300 : (nodeCount > 15 ? 300 : 330); // 节点少时使用更大偏移

    // 方向偏移量 - 基于最小间距优化
    const directionOffsets: Record<string, { x: number; y: number }> = {
        north: { x: 0, y: -BASE_OFFSET },
        south: { x: 0, y: BASE_OFFSET },
        east: { x: BASE_OFFSET, y: 0 },
        west: { x: -BASE_OFFSET, y: 0 },
        northeast: { x: BASE_OFFSET * 0.7, y: -BASE_OFFSET * 0.7 },
        northwest: { x: -BASE_OFFSET * 0.7, y: -BASE_OFFSET * 0.7 },
        southeast: { x: BASE_OFFSET * 0.7, y: BASE_OFFSET * 0.7 },
        southwest: { x: -BASE_OFFSET * 0.7, y: BASE_OFFSET * 0.7 },
        up: { x: 0, y: -BASE_OFFSET },
        down: { x: 0, y: BASE_OFFSET },
    };

    // 碰撞检测函数 - 使用最小间距
    const hasCollision = (x: number, y: number, excludeId?: string): boolean => {
        for (const [id, pos] of Object.entries(positions)) {
            if (excludeId && id === excludeId) continue;
            const distance = Math.sqrt((pos.x - x) ** 2 + (pos.y - y) ** 2);
            if (distance < MIN_DISTANCE) return true;
        }
        return false;
    };

    // 改进的螺旋搜索 - 使用更密集的搜索模式
    const findFreePosition = (centerX: number, centerY: number): { x: number; y: number } => {
        let angle = 0;
        let radius = MIN_DISTANCE; // 从最小距离开始
        let attempts = 0;
        const maxAttempts = 100; // 增加尝试次数
        const angleStep = Math.PI / 8; // 更小的角度步进，更密集搜索
        const radiusIncrement = MIN_DISTANCE * 0.5; // 更小的半径增量

        while (attempts < maxAttempts) {
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            if (!hasCollision(x, y)) {
                return { x, y };
            }

            angle += angleStep;
            if (angle >= Math.PI * 2) {
                angle = 0;
                radius += radiusIncrement;
            }
            attempts++;
        }
        // 如果找不到，尝试更大的随机搜索范围
        let fallbackAttempts = 0;
        while (fallbackAttempts < 50) {
            const x = centerX + (Math.random() - 0.5) * radius * 4;
            const y = centerY + (Math.random() - 0.5) * radius * 4;
            if (!hasCollision(x, y)) {
                return { x, y };
            }
            fallbackAttempts++;
        }
        // 最后的后备方案：强制放置，但保证最小距离
        return { x: centerX + radius * 2, y: centerY + radius * 2 };
    };

    // 使用BFS遍历并布局场景
    const visited = new Set<string>();
    const queue = [ids[0]];

    // 设置起始场景在中心
    if (queue[0]) {
        positions[queue[0]] = { x: 500, y: 400 };
        visited.add(queue[0]);
    }

    while (queue.length > 0) {
        const currentId = queue.shift() as string;
        const scene = m[currentId];
        const currentPos = positions[currentId];

        if (!scene || !currentPos || !scene.exits) continue;

        // 处理所有出口
        Object.entries(scene.exits).forEach(([direction, targetId]) => {
            const targetIdStr = String(targetId);
            if (visited.has(targetIdStr) || !m[targetIdStr]) return;

            const offset = directionOffsets[direction] || { x: BASE_OFFSET, y: BASE_OFFSET };
            let targetX = currentPos.x + offset.x;
            let targetY = currentPos.y + offset.y;

            // 总是检查碰撞，确保不重叠
            if (hasCollision(targetX, targetY)) {
                const freePos = findFreePosition(currentPos.x, currentPos.y);
                targetX = freePos.x;
                targetY = freePos.y;
            }

            positions[targetIdStr] = { x: targetX, y: targetY };
            visited.add(targetIdStr);
            queue.push(targetIdStr);
        });
    }

    // 处理未访问的场景（孤立节点）
    ids.forEach(id => {
        if (!visited.has(id)) {
            positions[id] = findFreePosition(500, 400);
        }
    });

    // 二次优化：检查所有节点对，确保没有重叠
    // 增加迭代次数和推开力度，特别是节点多时
    let optimized = false;
    let maxIterations = nodeCount > 15 ? 20 : 15; // 节点多时增加迭代次数
    while (!optimized && maxIterations > 0) {
        optimized = true;
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const id1 = ids[i];
                const id2 = ids[j];
                if (!positions[id1] || !positions[id2]) continue;
                
                const dx = positions[id1].x - positions[id2].x;
                const dy = positions[id1].y - positions[id2].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 如果距离小于最小间距，增加额外的安全边距
                const safeDistance = MIN_DISTANCE + 15; // 增加15px安全边距
                if (distance < safeDistance && distance > 0) {
                    // 调整位置，将节点推开，增加推开力度
                    const moveDistance = (safeDistance - distance) / 2 + 15; // 增加推开距离
                    const angle = Math.atan2(dy, dx);
                    
                    // 避免除以零
                    if (isNaN(angle)) continue;
                    
                    positions[id1].x += Math.cos(angle) * moveDistance;
                    positions[id1].y += Math.sin(angle) * moveDistance;
                    positions[id2].x -= Math.cos(angle) * moveDistance;
                    positions[id2].y -= Math.sin(angle) * moveDistance;
                    
                    optimized = false;
                }
            }
        }
        maxIterations--;
    }

    // 计算边界，但不缩放（允许地图内容超出viewBox，通过滚动查看）
    const allPos = Object.values(positions);
    if (allPos.length === 0) return positions;

    // 返回原始位置，让SVG的viewBox和滚动容器处理显示
    return positions;
};

const MapModal: React.FC<MapModalProps> = ({
    isOpen,
    onClose,
    scenes,
    currentSceneId,
    onSceneClick,
    worldMapImageUrl,
    player
}) => {

    // 计算位置并应用缩放以适应固定容器，同时保证节点不会太小
    const { positions, viewBox } = useMemo(() => {
        const rawPositions = computePositions(scenes);
        const allPos = Object.values(rawPositions);
        
        if (allPos.length === 0) {
            return { positions: rawPositions, viewBox: "0 0 1000 800" };
        }
        
        const NODE_RADIUS = 90;
        const MARGIN = 80;
        const FIXED_WIDTH = 1000;
        const FIXED_HEIGHT = 800;
        // 根据节点数量动态调整最小缩放比例，确保字体和节点可读
        // 节点越多，最小缩放比例越大（但不超过1）
        const nodeCount = allPos.length;
        // 最小缩放比例：节点少时0.5，节点多时逐渐增加到0.7
        const MIN_SCALE = Math.min(0.7, Math.max(0.5, 0.5 + nodeCount * 0.01));
        
        const minX = Math.min(...allPos.map(p => p.x));
        const maxX = Math.max(...allPos.map(p => p.x));
        const minY = Math.min(...allPos.map(p => p.y));
        const maxY = Math.max(...allPos.map(p => p.y));
        
        // 计算实际内容范围（包括节点半径）
        const contentWidth = maxX - minX + NODE_RADIUS * 2;
        const contentHeight = maxY - minY + NODE_RADIUS * 2;
        
        // 计算缩放比例，使内容适应固定容器
        const scaleX = (FIXED_WIDTH - MARGIN * 2) / contentWidth;
        const scaleY = (FIXED_HEIGHT - MARGIN * 2) / contentHeight;
        let scale = Math.min(scaleX, scaleY, 1); // 不放大，只缩小
        
        // 确保缩放不会太小，保证节点和字体可读
        scale = Math.max(scale, MIN_SCALE);
        
        // 计算居中偏移
        const scaledContentWidth = contentWidth * scale;
        const scaledContentHeight = contentHeight * scale;
        const offsetX = MARGIN + (FIXED_WIDTH - MARGIN * 2 - scaledContentWidth) / 2;
        const offsetY = MARGIN + (FIXED_HEIGHT - MARGIN * 2 - scaledContentHeight) / 2;
        
        // 应用缩放和居中到所有位置
        const scaledPositions: Record<string, { x: number; y: number }> = {};
        Object.keys(rawPositions).forEach(id => {
            const pos = rawPositions[id];
            scaledPositions[id] = {
                x: offsetX + (pos.x - minX) * scale + NODE_RADIUS * scale,
                y: offsetY + (pos.y - minY) * scale + NODE_RADIUS * scale
            };
        });
        
        return {
            positions: scaledPositions,
            viewBox: `0 0 ${FIXED_WIDTH} ${FIXED_HEIGHT}`
        };
    }, [scenes]);
    
    if (!isOpen) return null;
    console.log(player);
    
    
    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>大地图</h2>
                    <div className={styles.actions}>
                        <button className={styles.closeBtn} onClick={onClose}>×</button>
                    </div>
                </div>
                <div 
                    className={styles.content}
                >
                    <div className={styles.mapContainer}
                    style={{
                        backgroundImage: worldMapImageUrl ? `url(${worldMapImageUrl})` : 'none',
                        backgroundSize: '94% 95%',
                        backgroundPosition: 'top center',
                        backgroundRepeat: 'no-repeat',
                        borderRadius: '5%', // 圆角
                        overflow: 'hidden',
                    }}
                    >
                        <svg 
                            className={styles.mapSvg} 
                            viewBox={viewBox}
                            preserveAspectRatio="xMidYMid meet"
                        >
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
                                                    stroke="#000000"
                                                    strokeWidth={18}
                                                />
                                            ) : null)
                                        : null))
                                }
                            </g>
                            <g>
                                {Object.entries(scenes).map(([id, sc]) => {
                                    if (!positions[id]) return null;
                                    
                                    const isUnlocked = player?.unlockedScenes?.includes(id) ?? false;
                                    const isCurrent = id === currentSceneId;
                                    const radius = isCurrent ? 90 : 80;
                                    
                                    return (
                                        <g
                                            key={id}
                                            onClick={() => onSceneClick && onSceneClick(id)}
                                            style={{ 
                                                cursor: isUnlocked ? 'pointer' : 'not-allowed',
                                                opacity: !isUnlocked ? 0.6 : 1,
                                                filter: !isUnlocked ? 'grayscale(0.5)' : 'none'
                                            }}
                                        >
                                            <defs>
                                                <clipPath id={`clip-${id}`}>
                                                    <circle cx={positions[id].x} cy={positions[id].y} r={radius} />
                                                </clipPath>
                                            </defs>
                                            <image
                                                href={`${HOST_ADDRESS}${sc.background}` || `${import.meta.env.BASE_URL}data/icons/empty.png`}
                                                x={positions[id].x - radius}
                                                y={positions[id].y - radius}
                                                width={radius * 2}
                                                height={radius * 2}
                                                clipPath={`url(#clip-${id})`}
                                                preserveAspectRatio="xMidYMid slice"
                                                style={{
                                                    filter: !isUnlocked ? 'brightness(0.5) grayscale(0.8)' : 'none'
                                                }}
                                            />
                                            <circle
                                                cx={positions[id].x}
                                                cy={positions[id].y}
                                                r={radius}
                                                fill="none"
                                                stroke="#000000"
                                                strokeWidth={isCurrent ? 10 : 9}
                                                style={{
                                                    opacity: !isUnlocked ? 0.7 : 1
                                                }}
                                            />
                                            {!isUnlocked && (
                                                <g>
                                                    {/* 锁图标背景圆形，让图标更明显 */}
                                                    <circle
                                                        cx={positions[id].x}
                                                        cy={positions[id].y}
                                                        r={radius * 0.6}
                                                        fill="rgba(0, 0, 0, 0.7)"
                                                    />
                                                    <foreignObject
                                                        x={positions[id].x - radius * 0.5}
                                                        y={positions[id].y - radius * 0.5 - 30}
                                                        width={radius}
                                                        height={radius}
                                                    >
                                                        <div className={styles.lockIcon}>
                                                            <MdLockClock size={radius * 1}/>
                                                        </div>
                                                    </foreignObject>
                                                </g>
                                            )}
                                            <text
                                                x={positions[id].x}
                                                y={isUnlocked ? positions[id].y + 12 : positions[id].y + radius- 20}
                                                textAnchor="middle"
                                                fill="#29323c"
                                                fontSize={36}
                                                fontWeight="bold"
                                            >
                                                {sc.name.length > 6 ? sc.name.substring(0, 6) : sc.name}
                                            </text>
                                        </g>
                                    );
                                })}
                            </g>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MapModal;