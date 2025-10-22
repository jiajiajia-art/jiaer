import React from 'react';

interface Modal{
    isOpen: boolean;
    onClose: () => void;
    player: any; // 恢复为原始类型
}

const PlayerFloatingPanel:React.FC<Modal> = () => {
    return <>

        <div id="playerFloatingPanel" className="player-floating-panel">
            <div className="player-panel-header">
                <h3>角色信息</h3>
                <button id="closePlayerBtn" className="close-player-btn">×</button>
            </div>
            <div className="player-panel-content">
                <div className="player-info">
                    <div className="player-avatar">
                        <img id="playerAvatar" src="data/avatars/default.png" alt="角色头像"/>
                    </div>
                    <div className="player-details">
                        <div className="player-basic">
                            <h3 id="playerName">未命名</h3>
                            <p><span className="label">年龄:</span> <span id="playerAge">-</span></p>
                            <p><span className="label">性别:</span> <span id="playerGender">-</span></p>
                            <p><span className="label">职业:</span> <span id="playerJob">-</span></p>
                        </div>
                        <div className="player-stats">
                            <h4>属性</h4>
                            <div className="stat-bar">
                                <span className="stat-label">等级:</span>
                                <span id="playerLevel" className="stat-value">1</span>
                            </div>
                            <div className="stat-bar">
                                <span className="stat-label">生命:</span>
                                <span id="playerHealth" className="stat-value">100/100</span>
                            </div>
                            <div className="stat-bar">
                                <span className="stat-label">攻击:</span>
                                <span id="playerAttack" className="stat-value">10</span>
                            </div>
                            <div className="stat-bar">
                                <span className="stat-label">防御:</span>
                                <span id="playerDefense" className="stat-value">5</span>
                            </div>
                            <div className="stat-bar">
                                <span className="stat-label">速度:</span>
                                <span id="playerSpeed" className="stat-value">8</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </>
}

export default PlayerFloatingPanel;
