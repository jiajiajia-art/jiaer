import { useState, useCallback } from 'react';
import styles from './GameSettingsEditor.module.css';
import DocumentsPanel from '../components/GameSettingEditor/DocumentsPanel';
import WorldPanel from '../components/GameSettingEditor/WorldPanel';
import CharactersPanel from '../components/GameSettingEditor/CharactersPanel';
import ScenesPanel from '../components/GameSettingEditor/ScenesPanel';
import Sidebar from '../components/GameSettingEditor/Sidebar';
import { authFetch } from '../api/base';

const GameSettingsEditor = () => {
    const [activePanel, setActivePanel] = useState<string>('documents');
    const [isParsing, setIsParsing] = useState<boolean>(false);
    const [isParsed, setIsParsed] = useState<boolean>(false);

    const handlePanelChange = (panelId: string) => {
        // 如果正在解析，只能停留在 documents 面板
        if (isParsing && panelId !== 'documents') {
            return;
        }
        // 如果未解析完成，只能访问 documents 面板
        if (!isParsed && panelId !== 'documents') {
            return;
        }
        setActivePanel(panelId);
    };

    const handleFileUpload = async (file: File): Promise<boolean> => {
        const formData = new FormData();
        formData.append('document', file);
        try {
            const response = await authFetch('/api/visual/document/upload', {
                method: 'POST',
                body: formData,
            });
            if (response.ok) {
                const data = await response.json();
                console.log('File uploaded successfully:', data);
                return true;
            } else {
                console.error('Error uploading file:', response.statusText);
                return false;
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            return false;
        }
    };

    const handleParsingStart = useCallback(() => {
        setIsParsing(true);
        setIsParsed(false);
    }, []);

    const handleParsingComplete = useCallback(() => {
        setIsParsing(false);
        setIsParsed(true);
        // 延迟1秒后自动跳转到下一步
        setTimeout(() => {
            setActivePanel('world');
        }, 1000);
    }, []);

    return (
        <div className={styles.appShell}>
            <Sidebar
                activePanel={activePanel}
                onPanelChange={handlePanelChange}
                isParsing={isParsing}
                isParsed={isParsed}
            />
            <main className={styles.main}>
                <header className={styles.topBar}>
                    <div>
                        <p className={styles.eyebrow}>KURAN · CREATOR</p>
                        <h1>游戏创作流程</h1>
                        <p className={styles.subtitle}>
                            Step 1 上传 Word / PDF → Step 2 表单化校对世界观 → Step 3 角色差分 → Step 4
                            场景绑定 BGM
                        </p>
                    </div>
                    <div className={styles.topActions}>
                        <button className={styles.primary}>保存全部设置</button>
                    </div>
                </header>

                <section className={`${styles.panel} ${activePanel === 'documents' ? styles.active : ''}`} id="documents">
                    <DocumentsPanel 
                        onFileUpload={handleFileUpload} 
                        isParsing={isParsing}
                        onParsingStart={handleParsingStart}
                        onParsingComplete={handleParsingComplete}
                    />
                </section>

                <section className={`${styles.panel} ${activePanel === 'world' ? styles.active : ''}`} id="world">
                    <WorldPanel />
                </section>

                <section className={`${styles.panel} ${activePanel === 'characters' ? styles.active : ''}`} id="characters">
                    <CharactersPanel />
                </section>

                <section className={`${styles.panel} ${activePanel === 'scenes' ? styles.active : ''}`} id="scenes">
                    <ScenesPanel />
                </section>
            </main>
        </div>
    );
};

export default GameSettingsEditor;
