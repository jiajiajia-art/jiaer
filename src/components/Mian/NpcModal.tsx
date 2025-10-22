import React from 'react';

interface Modal{
    isOpen: boolean;
    onClose: () => void;
}

const NpcModal:React.FC<Modal> = () => {
    return <>
        <div id="npcModal" className="modal">
            <div className="modal-content npc-modal-content">
                <button className="close-npc-modal">×</button>
                <div className="npc-detail-header">
                    <img id="npcDetailAvatar" src="" alt="NPC头像" className="npc-detail-avatar" />
                    <div className="npc-detail-info">
                        <h2 id="npcDetailName">NPC姓名</h2>
                        <div className="npc-detail-stats">
                            <span className="npc-detail-job" id="npcDetailJob">职业</span>
                            <span className="npc-detail-gender" id="npcDetailGender">性别</span>
                            <span className="npc-detail-age" id="npcDetailAge">年龄</span>
                        </div>
                    </div>
                </div>
                <div className="npc-detail-description">
                    <p id="npcDetailDesc">描述</p>
                </div>
                <div className="npc-relationships">
                    <h3>人际关系</h3>
                    <div id="npcRelationshipsList" className="relationships-grid">
                        {/* 关系列表动态生成 */}
                    </div>
                </div>
                <div className="npc-actions">
                    <button id="chatWithNPCBtn" className="chat-with-npc-btn">💬 与TA对话</button>
                </div>
            </div>
        </div>
    </>
}

export default NpcModal;
