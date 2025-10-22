import React from 'react';

interface Modal{
    isOpen: boolean;
    onClose: () => void;
    player: any; // 恢复为原始类型
}

const InventoryFloatingPanel:React.FC<Modal> = () => {
    return <>
        <div id="inventoryFloatingPanel" className="inventory-floating-panel">
            <div className="inventory-panel-header">
                <h3>背包</h3>
                <button id="closeInventoryBtn" className="close-inventory-btn">×</button>
            </div>
            <div className="inventory-panel-content">
                {/* 装备区域 */}
                <div className="equipment-section">
                    <h3>装备</h3>
                    <div className="equipment-grid">
                        <div className="equipment-slot" data-slot="head">
                            <img src="data/icons/empty.png" alt="头部" />
                            <span>头部</span>
                        </div>
                        <div className="equipment-slot" data-slot="body">
                            <img src="data/icons/empty.png" alt="上身" />
                            <span>上身</span>
                        </div>
                        <div className="equipment-slot" data-slot="legs">
                            <img src="data/icons/empty.png" alt="下身" />
                            <span>下身</span>
                        </div>
                        <div className="equipment-slot" data-slot="hands">
                            <img src="data/icons/empty.png" alt="手部" />
                            <span>手部</span>
                        </div>
                        <div className="equipment-slot" data-slot="feet">
                            <img src="data/icons/empty.png" alt="脚部" />
                            <span>脚部</span>
                        </div>
                        <div className="equipment-slot" data-slot="back">
                            <img src="data/icons/empty.png" alt="背部" />
                            <span>背部</span>
                        </div>
                        <div className="equipment-slot" data-slot="leftHand">
                            <img src="data/icons/empty.png" alt="左手武器" />
                            <span>左手</span>
                        </div>
                        <div className="equipment-slot" data-slot="rightHand">
                            <img src="data/icons/empty.png" alt="右手武器" />
                            <span>右手</span>
                        </div>
                    </div>
                </div>
                {/* 物品区域 */}
                <div className="items-section">
                    <h3>物品</h3>
                    <div id="itemsGrid" className="items-grid">
                        {/* 物品将通过JavaScript动态生成 */}
                    </div>
                </div>
            </div>
        </div>
    </>
}

export default InventoryFloatingPanel;
