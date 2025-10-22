import React from 'react';

interface Modal{
    isOpen: boolean;
    onClose: () => void;
}

const SceneDetailModal:React.FC<Modal> = () => {
    return <>
        <div id="sceneDetailModal" className="modal">
            <div className="modal-content scene-modal-content">
                <button className="close-scene-modal">×</button>
                <div className="scene-detail-image">
                    <img id="sceneDetailImage" src="" alt="场景图片" />
                </div>
                <div className="scene-detail-info">
                    <h2 id="sceneDetailName">场景名称</h2>
                    <div className="scene-detail-description">
                        <p id="sceneDetailDesc">场景描述</p>
                    </div>
                    <div className="scene-travel-cost">
                        <div className="cost-info">
                            <span className="cost-label">旅行费用：</span>
                            <span id="travelCost" className="cost-value">10</span>
                            <span className="cost-icon">💰</span>
                        </div>
                        <div className="player-gold">
                            <span className="gold-label">你的金币：</span>
                            <span id="playerGoldDisplay" className="gold-value">100</span>
                            <span className="gold-icon">💰</span>
                        </div>
                    </div>
                    <div className="scene-detail-actions">
                        <button id="goToSceneBtn" className="go-to-scene-btn">🚀 前往此场景</button>
                    </div>
                </div>
            </div>
        </div>
    </>
}

export default SceneDetailModal;