import React from 'react';

interface Modal{
    isOpen: boolean;
    onClose: () => void;
}
const LorePanel:React.FC<Modal> = () => {
    return <>
        <div id="lorePanel" className="lore-floating-panel">
            <div className="lore-panel-header">
                <h3>世界观</h3>
                <button id="closeLoreBtn" className="close-lore-btn">×</button>
            </div>
            <div className="lore-panel-content">
                <div className="lore-section">
                    <h4>📖 世界背景</h4>
                    <div id="worldLoreContent" className="lore-content">
                        {/* <!-- 世界背景故事 --> */}
                    </div>
                </div>
                <div className="lore-section">
                    <h4>⚔️ 主角故事</h4>
                    <div id="playerLoreContent" className="lore-content">
                        {/* <!-- 玩家主角故事 --> */}
                    </div>
                </div>
            </div>
        </div>
    </>
}

export default LorePanel;
