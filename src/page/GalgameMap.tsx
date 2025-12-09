// GalgameMap.tsx
import { useEffect, useState, useRef } from "react";
import styles from "./GalgameMap.module.css";
import MapWorldData from "../api/worldInteraction/mapWorldData";
import { useGameStore } from "../store/gameStore";
import WorldMapRenderer from "../components/GalgameMap/WorldMapRenderer";
import type { AllGameData } from "../api/worldInteraction/mapWorldData.type";
import StoryIntroModal from "../components/GalgameMap/StoryIntroModal";

const GalgameMap = () => {
    const { pdfFileId } = useGameStore();
    const [gameData, setGameData] = useState<AllGameData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showStoryIntro, setShowStoryIntro] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        getMapWorldData();
    }, [pdfFileId]);

    // 确保组件在显示前已经准备好
    useEffect(() => {
        if (!showStoryIntro) {
            // 给DOM一个渲染周期的时间
            const timer = setTimeout(() => {
                setIsReady(true);
                // 强制重绘，修复尺寸计算问题
                if (containerRef.current) {
                    const event = new Event('resize');
                    window.dispatchEvent(event);
                }
            }, 50);
            
            return () => clearTimeout(timer);
        }
    }, [showStoryIntro]);

    const getMapWorldData = async () => {
        if (!pdfFileId) {
            setError('缺少 fileId');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await MapWorldData.getMapWorldData(pdfFileId);
            if (response.data.success && response.data) {
                setGameData(response.data);
            } else {
                setError('获取地图数据失败');
            }
        } catch (error) {
            console.error("获取地图世界数据失败:", error);
            setError('获取地图数据失败，请重试');
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartGame = () => {
        setShowStoryIntro(false);
    };

    return (
        <div className={styles.page} ref={containerRef}>
            <div className={styles.mapContainer}>
                {(!showStoryIntro || isReady) && (
                    <WorldMapRenderer 
                        gameData={gameData} 
                        isLoading={isLoading} 
                        key={showStoryIntro ? 'intro' : 'game'} // 添加key强制重新渲染
                    />
                )}
                <StoryIntroModal
                    isOpen={showStoryIntro}
                    gameData={gameData}
                    onStartGame={handleStartGame}
                />
            </div>
        </div>
    );
};

export default GalgameMap;