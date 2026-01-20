import React, { useRef, useState } from 'react';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import { HOST_ADDRESS } from '../config';
import { authFetch } from '../api/base';
import { useNavigate } from 'react-router-dom';
import styles from './CustomIFCreate.module.css';

const CustomIFCreate: React.FC = () => {
  const [title, setTitle] = useState('我的游戏');
  const [version, setVersion] = useState('1.0.0');
  const [manifestText, setManifestText] = useState('');
  const [creating, setCreating] = useState(false);
  const [appId, setAppId] = useState<string>('');
  const [entryUrl, setEntryUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleCreate = async () => {
    setError('');
    if (creating) return;
    try {
      const file = fileRef.current?.files?.[0];
      if (!file) { setError('请上传游戏文件'); return; }
      setCreating(true);
      // 1) create empty app
      const resp = await authFetch(`${HOST_ADDRESS}/api/custom/apps/create-empty`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ title: title || '我的游戏' }) });
      if (!resp.ok) throw new Error(await resp.text());
      const meta = await resp.json();
      const id = meta?.appId || meta?.data?.appId || '';
      if (!id) throw new Error('服务端未返回 appId');
      setAppId(id);
      // 2) upload ui
      const fd = new FormData();
      fd.append('version', version);
      // 直接上传原始 File，避免某些浏览器 arrayBuffer() 异常导致 0 字节
      const size = file.size || 0;
      console.log('[CustomIF upload] local index bytes=', size);
      if (size <= 0) { throw new Error('选择的 index.html 文件为空'); }
      // 将文件作为表单字段 `index` 发送（与后端约定字段名）
      fd.append('index', file, file.name || 'index.html');
      if (manifestText.trim()) fd.append('manifest', manifestText);
      const up = await authFetch(`${HOST_ADDRESS}/api/custom/apps/${id}/ui/upload`, { method:'POST', body: fd });
      if (!up.ok) throw new Error(await up.text());
      const upJson = await up.json();
      console.log('[CustomIF upload]', upJson);
      const entry = upJson?.entry || upJson?.entryUrl || `/public/custom/apps/${id}/ui/${version}/index.html`;
      setEntryUrl(entry);
    } catch (e:any) {
      setError(String(e?.message || e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.pageRoot}>
      <Navbar />
      <div className={styles.mainContent}>
        <div className={styles.main}>
          <div className={styles.formSection}>
            <div className={styles.formGroup}>
              <label htmlFor="title">标题</label>
              <input
                id="title"
                className={styles.textInput}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="我的游戏"
                autoComplete="off"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="version">版本号</label>
              <input
                id="version"
                className={styles.textInput}
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                autoComplete="off"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="index">index.html 文件</label>
              <div className={styles.fileRow}>
                <input
                  id="index"
                  ref={fileRef}
                  type="file"
                  accept="text/html,.html"
                  className={styles.fileInput}
                />
                <div className={styles.hint}>请选择你的自定义游戏入口文件 index.html</div>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="manifest">manifest（可选）</label>
              <textarea
                id="manifest"
                className={styles.textarea}
                value={manifestText}
                onChange={(e) => setManifestText(e.target.value)}
                placeholder='{"allowedModels":["claude-3-5-sonnet-20240620"]}'
                rows={6}
              />
            </div>

            {error && (
              <div className={styles.formGroup}>
                <label />
                <div className={styles.error}>{error}</div>
              </div>
            )}

            <div className={styles.formGroup}>
              <label />
              <div className={styles.actions}>
                <button onClick={handleCreate} disabled={creating} className={styles.primaryBtn}>
                  {creating ? '创建中…' : '创建并上传'}
                </button>
                {appId && (
                  <div className={styles.infoRow}>
                    <button onClick={() => navigate(`/customif/${appId}`)} className={styles.secondaryBtn}>
                      开始测试
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <FooterArea />
    </div>
  );
};

export default CustomIFCreate;
