import React, { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import { HOST_ADDRESS } from '../config';
import { authFetch } from '../api/base';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './CustomIFCreate.module.css';

const CustomIFCreate: React.FC = () => {
  const [title, setTitle] = useState('我的游戏');
  const [version, setVersion] = useState('1.0.0');
  const [manifestText, setManifestText] = useState('');
  const [creating, setCreating] = useState(false);
  const [appId, setAppId] = useState<string>('');
  const [, setEntryUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 方案A：带 appId 进入“编辑模式”
  const appIdFromQuery = searchParams.get('appId') || '';
  const isEditMode = useMemo(() => !!appIdFromQuery, [appIdFromQuery]);

  useEffect(() => {
    if (isEditMode) {
      setAppId(appIdFromQuery);
    }
  }, [isEditMode, appIdFromQuery]);

  // 上传模式：single（仅 index.html），zip（客户端解包后多文件），dir（选择目录 多文件）
  type UploadMode = 'single' | 'zip' | 'dir';
  const [mode, setMode] = useState<UploadMode>('single');
  const zipRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  type MultiItem = { path: string; file: File; selected: boolean };
  const [multiFiles, setMultiFiles] = useState<MultiItem[]>([]);
  const [multiStats, setMultiStats] = useState<{ count: number; bytes: number; selCount: number; selBytes: number }>({ count: 0, bytes: 0, selCount: 0, selBytes: 0 });
  const [entryPath, setEntryPath] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  function formatBytes(n:number){
    if(n<1024) return `${n} B`; if(n<1024*1024) return `${(n/1024).toFixed(1)} KB`; return `${(n/1024/1024).toFixed(1)} MB`; }
  function normalizePath(p:string){
    let s = p.replace(/\\+/g,'/');
    s = s.replace(/^\/+/, '');
    const parts:string[] = [];
    for(const seg of s.split('/')){ if(seg===''||seg==='.') continue; if(seg==='..'){ parts.pop(); } else { parts.push(seg); } }
    return parts.join('/');
  }
  function guessMime(name:string){
    const ext = name.toLowerCase().split('.').pop()||'';
    switch(ext){
      case 'html': return 'text/html';
      case 'js': return 'application/javascript';
      case 'css': return 'text/css';
      case 'json': return 'application/json';
      case 'png': return 'image/png';
      case 'jpg': case 'jpeg': return 'image/jpeg';
      case 'gif': return 'image/gif';
      case 'svg': return 'image/svg+xml';
      case 'webp': return 'image/webp';
      case 'mp3': return 'audio/mpeg';
      case 'wav': return 'audio/wav';
      case 'ogg': return 'audio/ogg';
      case 'ttf': return 'font/ttf';
      case 'woff': return 'font/woff';
      case 'woff2': return 'font/woff2';
      default: return 'application/octet-stream';
    }
  }

  function updateMultiStats(list: MultiItem[]){
    const bytes = list.reduce((a,b)=> a + (b.file.size||0), 0);
    const sel = list.filter(i=> i.selected);
    const selBytes = sel.reduce((a,b)=> a + (b.file.size||0), 0);
    setMultiStats({ count: list.length, bytes, selCount: sel.length, selBytes });
    // 自动识别 entryPath（唯一的 */index.html 或 根 index.html）
    const candidates = list.filter(i=> /(^|\/)index\.html$/i.test(i.path)).map(i=> i.path);
    if (candidates.length === 1) setEntryPath(candidates[0]);
  }

  // 目录上传：读取 webkitRelativePath
  const handlePickDir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const items: MultiItem[] = [];
    for(const f of files){
      // @ts-ignore webkitRelativePath by browsers
      const rel = (f as any).webkitRelativePath || f.name;
      const path = normalizePath(rel);
      if (!path) continue;
      items.push({ path, file: f, selected: true });
    }
    setMultiFiles(items);
    updateMultiStats(items);
  };

  // ZIP 上传：动态加载 fflate 并解压
  async function ensureZipLib(){
    if ((window as any).fflate) return;
    await new Promise<void>((resolve, reject)=>{
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.min.js';
      s.onload = ()=> resolve(); s.onerror = ()=> reject(new Error('fflate load failed'));
      document.head.appendChild(s);
    });
  }
  const handlePickZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await ensureZipLib();
      const buf = new Uint8Array(await file.arrayBuffer());
      // @ts-ignore
      const out = (window as any).fflate.unzipSync(buf);
      const list: MultiItem[] = [];
      for (const k of Object.keys(out||{})){
        const u8 = out[k];
        if (!(u8 && u8.length>=0)) continue;
        const path = normalizePath(k);
        if (!path) continue;
        const mime = guessMime(path);
        const f = new File([u8], path.split('/').pop()||'file', { type: mime });
        list.push({ path, file: f, selected: true });
      }
      setMultiFiles(list);
      updateMultiStats(list);
    } catch (err:any) {
      setError('解压失败：' + (err?.message || err));
    }
  };

  const toggleSelect = (idx:number, checked:boolean) => {
    setMultiFiles(prev => {
      const next = prev.slice();
      if (next[idx]) next[idx].selected = checked;
      updateMultiStats(next);
      return next;
    });
  };

  const selectAll = (checked:boolean) => {
    setMultiFiles(prev => {
      const next = prev.map(i => ({...i, selected: checked}));
      updateMultiStats(next);
      return next;
    });
  };

  // 最终上传动作
  const doUpload = async () => {
    setError('');
    if (creating) return;
    try {
      // 校验输入
      if (mode === 'single') {
        const file = fileRef.current?.files?.[0]; if (!file) { setError('请上传 index.html'); return; }
      } else {
        if (multiFiles.length === 0) { setError('未选择任何文件'); return; }
        const sel = multiFiles.filter(i=> i.selected);
        if (sel.length === 0) { setError('请至少选择一个文件'); return; }
        if (entryPath && !sel.some(i=> i.path === entryPath)) { setError(`必须选择入口文件：${entryPath}`); return; }
      }
      setCreating(true);
      let id = appIdFromQuery || appId;
      // 创建模式：先创建 App；编辑模式：直接使用已有 appId
      if (!isEditMode) {
        const resp = await authFetch(`${HOST_ADDRESS}/api/custom/apps/create-empty`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ title: title || '我的游戏' }) });
        if (!resp.ok) throw new Error(await resp.text());
        const meta = await resp.json();
        id = meta?.appId || meta?.data?.appId || '';
        if (!id) throw new Error('服务端未返回 appId');
        setAppId(id);
      }
      // 2) upload ui（根据模式构建表单）
      const fd = new FormData();
      fd.append('version', version);
      if (manifestText.trim()) fd.append('manifest', manifestText);
      if (mode === 'single'){
        const file = fileRef.current?.files?.[0]!;
        const size = file.size || 0; if (size<=0) throw new Error('选择的 index.html 文件为空');
        fd.append('index', file, file.name || 'index.html');
      } else {
        // 多文件上传（客户端已获取文件清单）
        fd.append('mode', 'multi');
        // 若能唯一识别入口，提供 entryPath 以便后端确定入口
        if (entryPath) fd.append('entryPath', entryPath);
        for(const it of multiFiles.filter(i=> i.selected)){
          fd.append('files[]', it.file, it.path.split('/').pop()||'file');
          fd.append('paths[]', it.path);
        }
      }
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
      setConfirmOpen(false);
    }
  };

  // 点击“创建并上传/上传新版本”时的入口（多文件需二次确认）
  const handleCreate = () => {
    setError('');
    if (mode === 'single') return void doUpload();
    if (multiFiles.length === 0) { setError('请先选择 ZIP 或目录'); return; }
    setConfirmOpen(true);
  };

  return (
    <div className={styles.pageRoot}>
      <Navbar />
      <div className={styles.mainContent}>
        <div className={styles.main}>
          <div className={styles.formSection}>
            <h2 style={{margin:'0 0 6px'}}>{isEditMode ? '编辑自定义游戏（Custom IF）' : '创建自定义游戏（Custom IF）'}</h2>
            {!isEditMode && (
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
            )}

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
              <label>上传方式</label>
              <div className={styles.fileRow}>
                <div className={styles.seg}>
                  <button type="button" className={`${styles.segBtn} ${mode==='single'?styles.segBtnActive:''}`} onClick={()=> setMode('single')}>单文件</button>
                  <button type="button" className={`${styles.segBtn} ${mode==='zip'?styles.segBtnActive:''}`} onClick={()=> setMode('zip')}>ZIP 包</button>
                  <button type="button" className={`${styles.segBtn} ${mode==='dir'?styles.segBtnActive:''}`} onClick={()=> setMode('dir')}>目录</button>
                </div>
                <div className={styles.hint}>单文件：只上传 index.html；ZIP/目录：一次上传所有资源。</div>
              </div>
            </div>

            {mode === 'single' && (
              <div className={styles.formGroup}>
                <label htmlFor="index">index.html 文件</label>
                <div className={styles.fileRow}>
                  <input id="index" ref={fileRef} type="file" accept="text/html,.html" className={styles.fileInput} />
                  <div className={styles.hint}>请选择你的自定义游戏入口文件 index.html</div>
                </div>
              </div>
            )}

            {mode === 'zip' && (
              <div className={styles.formGroup}>
                <label htmlFor="zip">ZIP 包</label>
                <div className={styles.fileRow}>
                  <input id="zip" ref={zipRef} type="file" accept=".zip,application/zip" className={styles.fileInput} onChange={handlePickZip} />
                  <div className={styles.hint}>将包含 index.html 的构建目录打包为 .zip</div>
                  {multiFiles.length>0 && (
                    <>
                      <div className={styles.listActions}>
                        <button type="button" className={styles.smallBtn} onClick={()=> selectAll(true)}>全选</button>
                        <button type="button" className={styles.smallBtn} onClick={()=> selectAll(false)}>全不选</button>
                      </div>
                      <div className={styles.fileStats}>
                        共 {multiStats.count} 个文件（{formatBytes(multiStats.bytes)}），已选 {multiStats.selCount}（{formatBytes(multiStats.selBytes)}）{entryPath?`，入口：${entryPath}`:''}
                      </div>
                      <div className={styles.fileList}>
                        {multiFiles.map((it, idx)=> (
                          <div className={styles.fileRowLine} key={it.path}>
                            <input className={styles.fileCheckbox} type="checkbox" checked={it.selected} onChange={(ev)=> toggleSelect(idx, ev.target.checked)} />
                            <span className={styles.filePath}>{it.path}</span>
                            <span className={styles.fileSize}>{formatBytes(it.file.size||0)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {mode === 'dir' && (
              <div className={styles.formGroup}>
                <label htmlFor="dir">选择目录</label>
                <div className={styles.fileRow}>
                  {/* @ts-ignore webkitdirectory */}
                  <input id="dir" ref={dirRef} type="file" className={styles.fileInput} onChange={handlePickDir} multiple webkitdirectory="true" />
                  <div className={styles.hint}>选择包含 index.html 的目录（需现代浏览器）</div>
                  {multiFiles.length>0 && (
                    <>
                      <div className={styles.listActions}>
                        <button type="button" className={styles.smallBtn} onClick={()=> selectAll(true)}>全选</button>
                        <button type="button" className={styles.smallBtn} onClick={()=> selectAll(false)}>全不选</button>
                      </div>
                      <div className={styles.fileStats}>
                        共 {multiStats.count} 个文件（{formatBytes(multiStats.bytes)}），已选 {multiStats.selCount}（{formatBytes(multiStats.selBytes)}）{entryPath?`，入口：${entryPath}`:''}
                      </div>
                      <div className={styles.fileList}>
                        {multiFiles.map((it, idx)=> (
                          <div className={styles.fileRowLine} key={it.path}>
                            <input className={styles.fileCheckbox} type="checkbox" checked={it.selected} onChange={(ev)=> toggleSelect(idx, ev.target.checked)} />
                            <span className={styles.filePath}>{it.path}</span>
                            <span className={styles.fileSize}>{formatBytes(it.file.size||0)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

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
                  {creating ? (isEditMode ? '上传中…' : '创建中…') : (isEditMode ? '上传新版本' : '创建并上传')}
                </button>
                {(appId || appIdFromQuery) && (
                  <div className={styles.infoRow}>
                    <button onClick={() => navigate(`/customif/${appId || appIdFromQuery}`)} className={styles.secondaryBtn}>
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
      {confirmOpen && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmCard}>
            <div className={styles.confirmHeader}>二次确认上传文件</div>
            <div className={styles.confirmBody}>
              <div style={{marginBottom:8}}>将上传版本：<b>{version}</b>，已选 <b>{multiStats.selCount}</b> 个文件（{formatBytes(multiStats.selBytes)}）。{entryPath?`入口：${entryPath}`:''}</div>
              <div className={styles.fileList}>
                {multiFiles.filter(i=> i.selected).map(it=> (
                  <div className={styles.fileRowLine} key={it.path}>
                    <span className={styles.filePath}>{it.path}</span>
                    <span className={styles.fileSize}>{formatBytes(it.file.size||0)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.confirmFooter}>
              <button className={styles.btnGhost} onClick={()=> setConfirmOpen(false)}>取消</button>
              <button className={styles.btnPrimary} onClick={doUpload} disabled={creating || multiStats.selCount===0}>确认上传</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomIFCreate;
