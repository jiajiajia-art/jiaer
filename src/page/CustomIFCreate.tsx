import React, { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import { HOST_ADDRESS } from '../config';
import { authFetch } from '../api/base';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './CustomIFCreate.module.css';
import UploadProgress from '../components/CreateGame/UploadProgress';
import toast from 'react-hot-toast';
import getGameDataApi from '../api/home/getGameData';

const CustomIFCreate: React.FC = () => {
  const [title, setTitle] = useState('');
  // 版本号已由服务端管理，无需前端填写
  const [manifestText, setManifestText] = useState('');
  const [creating, setCreating] = useState(false);
  const [appId, setAppId] = useState<string>('');
  const [, setEntryUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    const loadGameTitle = async () => {
      if (!isEditMode || !appIdFromQuery) return;
      try {
        const resp = await getGameDataApi.getGameDetail({ fileId: appIdFromQuery });
        const data = resp.data?.data;
        if (data && typeof data.title === 'string') {
          setTitle(data.title);
        }
      } catch (error) {
        console.error('加载游戏信息失败:', error);
        // 失败时不打断流程，仅提示
        toast.error('加载游戏标题失败，请稍后重试');
      }
    };

    void loadGameTitle();
  }, [isEditMode, appIdFromQuery]);


  // 复用草稿 appId（创建模式下避免重复 create-empty）
  const DRAFT_KEY = 'customif_draft_appId';
  useEffect(() => {
    if (!isEditMode && !appId) {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) setAppId(saved);
      } catch {}
    }
  }, [isEditMode, appId]);

  // 简化：通过拖放自动识别来源类型（single/zip/dir）
  type SourceType = 'single' | 'zip' | 'dir';
  const [sourceType, setSourceType] = useState<SourceType>('single');
  const changeSourceType = (t: SourceType) => {
    setError('');
    setSourceType(t);
    // 切换类型时重置，避免混淆
    setSingleFile(null);
    setMultiFiles([]);
    setEntryPath('');
    setMultiStats({ count: 0, bytes: 0, selCount: 0, selBytes: 0 });
  };
  // 旧的 zip/dir 选择器删除；保留单文件选择器以支持点击选择
  const singleRef = fileRef; // 语义别名：单文件 index.html 选择器
  type MultiItem = { path: string; file: File; selected: boolean };
  const [multiFiles, setMultiFiles] = useState<MultiItem[]>([]);
  const [multiStats, setMultiStats] = useState<{ count: number; bytes: number; selCount: number; selBytes: number }>({ count: 0, bytes: 0, selCount: 0, selBytes: 0 });
  const [entryPath, setEntryPath] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastUploadOk, setLastUploadOk] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [singleFile, setSingleFile] = useState<File | null>(null);

  // 上传进度与取消控制
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const startAtRef = useRef<number | null>(null);

  function startFakeProgress(max=90){
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    startAtRef.current = Date.now();
    setProgress(5);
    setProgressText('上传中…');
    const MAX_TIME = 20_000; // 20s 逼近 max
    progressTimerRef.current = window.setInterval(()=>{
      if (!startAtRef.current) return;
      const elapsed = Date.now() - startAtRef.current;
      const p = Math.min(5 + (elapsed / MAX_TIME) * (max - 5), max);
      setProgress(p);
    }, 120);
  }
  function stopFakeProgress(){
    if (progressTimerRef.current) { window.clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
    startAtRef.current = null;
  }

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

  // 目录上传（通过拖拽 DataTransferItem 递归读取）

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
  async function handleZipFile(file: File){
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
      setSourceType('zip');
      setMultiFiles(list);
      updateMultiStats(list);
    } catch (err:any) {
      setError('解压失败：' + (err?.message || err));
    }
  }

  // 大区域拖拽（ZIP 卡片）
  // 新的统一拖拽处理见下方 onZoneDrop

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
      if (sourceType === 'single') {
        const file = singleFile || fileRef.current?.files?.[0];
        if (!file) { setError('请上传 index.html'); return; }
      } else {
        if (multiFiles.length === 0) { setError('未选择任何文件'); return; }
        const sel = multiFiles.filter(i=> i.selected);
        if (sel.length === 0) { setError('请至少选择一个文件'); return; }
        if (entryPath && !sel.some(i=> i.path === entryPath)) { setError(`必须选择入口文件：${entryPath}`); return; }
      }
      setCreating(true);
      setIsUploading(true);
      setLastUploadOk(false);
      startFakeProgress();
      let id = appIdFromQuery || appId;
      // 创建模式：先创建 App；编辑模式：直接使用已有 appId
      if (!isEditMode && !id) {
        const resp = await authFetch(`${HOST_ADDRESS}/api/custom/apps/create-empty`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ title: title || '我的游戏' }) });
        if (!resp.ok) throw new Error(await resp.text());
        const meta = await resp.json();
        id = meta?.appId || meta?.data?.appId || '';
        if (!id) throw new Error('服务端未返回 appId');
        setAppId(id);
        try { localStorage.setItem(DRAFT_KEY, id); } catch {}
      }
      // 2) upload ui（根据模式构建表单）
      const fd = new FormData();
      if (manifestText.trim()) fd.append('manifest', manifestText);
      if (sourceType === 'single'){
        const file = (singleFile || fileRef.current?.files?.[0])!;
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
      // fetch with abort support
      abortRef.current = new AbortController();
      const up = await authFetch(`${HOST_ADDRESS}/api/custom/apps/${id}/ui/upload`, { method:'POST', body: fd, signal: abortRef.current.signal });
      if (!up.ok) throw new Error(await up.text());
      const upJson = await up.json();
      console.log('[CustomIF upload]', upJson);
      const entry = upJson?.entry || upJson?.entryUrl || `/public/custom/apps/${id}/ui/index.html`;
      setEntryUrl(entry);
      setLastUploadOk(true);
      setProgressText('上传完成');
      setProgress(100);
      stopFakeProgress();
      // 保持覆盖层不消失，展示操作按钮
      setIsUploading(true);
      toast.success('上传成功');
      // 上传成功后清理草稿标记
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
    } catch (e:any) {
      // 尝试解析后端错误
      let msg = String(e?.message || e);
      try {
        const j = JSON.parse(msg);
        if (j?.message) msg = j.message;
      } catch {}
      setError(msg);
      setLastUploadOk(false);
      stopFakeProgress();
      setIsUploading(false);
      toast.error(msg || '上传失败', { duration: 8000 });
    } finally {
      setCreating(false);
      setConfirmOpen(false);
    }
  };

  // 点击“创建并上传/上传新版本”时的入口（多文件需二次确认）
  const handleCreate = () => {
    setError('');
    if (sourceType === 'single') return void doUpload();
    if (multiFiles.length === 0) { setError('请先选择 ZIP 或目录'); return; }
    setConfirmOpen(true);
  };

  // 取消上传
  const handleCancelUpload = () => {
    if (abortRef.current) { try { abortRef.current.abort(); } catch {} abortRef.current = null; }
    stopFakeProgress();
    setIsUploading(false);
    setCreating(false);
    setProgress(0);
    setProgressText('');
    toast('已取消上传', { duration: 4000 });
  };

  // 离开页提醒：正在上传或有未提交选择且未成功
  useEffect(() => {
    const needWarn = isUploading || (multiFiles.length>0 && !lastUploadOk);
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (needWarn){ e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isUploading, multiFiles.length, lastUploadOk]);

  return (
    <div className={styles.pageRoot}>
      <Navbar />
      <div className={styles.mainContent}>
        <div className={styles.main}>
          <div className={styles.formSection}>
            <h2 style={{margin:'0 0 6px'}}>{isEditMode ? '编辑自定义游戏' : '创建自定义游戏'}</h2>
              <div className={styles.formGroup}>
                <label htmlFor="title">标题</label>
                <input
                  id="title"
                  className={styles.textInput}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoComplete="off"
                />
              </div>

            {/* 版本号输入已移除：由服务端管理当前激活版本 */}

            {/* 简化：单一大型拖放区域（支持 .zip / .html / 目录）且包含文件要求说明 */}
            <div className={styles.formGroup}>
              <label>上传</label>
              <div className={styles.uploaderColumn}>
                {/* 文件类型选择器：切换后渲染对应的上传区域与校验 */}
                <div className={styles.seg}>
                  <button type="button" className={`${styles.segBtn} ${sourceType==='single' ? styles.segBtnActive : ''}`} onClick={()=> changeSourceType('single')}>单文件 HTML</button>
                  <button type="button" className={`${styles.segBtn} ${sourceType==='zip' ? styles.segBtnActive : ''}`} onClick={()=> changeSourceType('zip')}>ZIP 包</button>
                  <button type="button" className={`${styles.segBtn} ${sourceType==='dir' ? styles.segBtnActive : ''}`} onClick={()=> changeSourceType('dir')}>文件夹</button>
                </div>

                <div className={`${styles.dropZoneLarge} ${dragOver? 'drag' : ''}`}
                   onDragOver={(e)=>{e.preventDefault(); setDragOver(true);}}
                   onDragLeave={(e)=>{e.preventDefault(); setDragOver(false);}}
                   onDrop={async (e)=>{
                     e.preventDefault(); setDragOver(false);
                     const items = e.dataTransfer.items;
                     if (items && items.length){
                       // @ts-ignore
                       const entry = items[0].webkitGetAsEntry && items[0].webkitGetAsEntry();
                       if (entry && entry.isDirectory){
                         // @ts-ignore
                         const readDirEntry = async (en:any, prefix:string): Promise<any[]> => {
                           const results: any[] = [];
                           if (en.isFile){ await new Promise<void>(res=> en.file((file:any)=>{ results.push({ path: normalizePath(prefix + file.name), file, selected:true }); res(); })); }
                           else if (en.isDirectory){ const reader = en.createReader(); await new Promise<void>(r=> reader.readEntries(async (ents:any[])=>{ for(const sub of ents){ const subList:any[]= await readDirEntry(sub, `${prefix}${en.name}/`); results.push(...subList);} r(); })); }
                           return results;
                         };
                          const list = await readDirEntry(entry, '');
                          // 切到目录模式并直接设置清单，避免因切换类型时清空列表的竞态
                          setSourceType('dir');
                          setSingleFile(null);
                          setMultiFiles(list as any);
                          updateMultiStats(list as any);
                          return;
                        }
                     }
                     const f = e.dataTransfer.files?.[0]; if (!f) return;
                     const name = (f.name||'').toLowerCase();
                     if (name.endsWith('.zip')) { setSingleFile(null); await handleZipFile(f); }
                     else if (name.endsWith('.html')) { changeSourceType('single'); setSingleFile(f); const dt = new DataTransfer(); dt.items.add(f); if (singleRef.current) singleRef.current.files = dt.files; }
                     else { setError('仅支持拖入 .zip、.html 或文件夹'); }
                   }}
                   onClick={(e)=>{
                     const target = e.target as HTMLElement;
                     // 整个红色虚线区域都可以点击触发上传
                     if (target.closest(`.${styles.cardFooter}`)) return;
                     if (sourceType === 'single') { if (singleRef.current){ singleRef.current.accept = 'text/html,.html'; singleRef.current.click(); } }
                     else if (sourceType === 'zip') { if (singleRef.current){ singleRef.current.accept = '.zip,application/zip'; singleRef.current.click(); } }
                     else if (sourceType === 'dir') { dirRef.current?.click(); }
                   }}
                >
                  <div className={styles.dropZoneInner}>
                    <div className={styles.dropContent}>
                      <div className={styles.dropIconWrapper}>
                        <svg className={styles.dropIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div className={styles.dropHeading}>上传自定义游戏</div>
                      <div className={styles.dropHint}>将 ZIP 包、index.html 或文件夹拖拽至此，或点击此处选择</div>
                    </div>
                  </div>

                  <div className={styles.dropListWrapper}>
                    <ul className={styles.dropList}>
                      <li>支持单index.html、ZIP包或文件夹方式上传。</li>
                      <li>ZIP包或文件夹必须包含入口文件 <b>index.html</b>（ZIP 内根目录或唯一子目录下）。</li>
                      <li>资源引用请使用<b>相对路径</b>（如 <code>./style.css</code>、<code>./data.json</code>）。</li>
                      <li>大小建议：单文件 ≤ 10MB、总大小 ≤ 50MB。</li>
                      <li>manifest配置（可选）：高级功能，有特殊需求请联系客服。</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* 隐藏文件选择器（点击大区域触发） */}
            <input id="index" ref={singleRef} type="file" accept="text/html,.html,.zip,application/zip" className={styles.fileInput} style={{display:'none'}} onChange={async (e)=>{ const input=e.currentTarget; const f=e.target.files?.[0]; if(!f){ input.value=''; return; } const n=(f.name||'').toLowerCase(); if(n.endsWith('.zip')) { setSingleFile(null); await handleZipFile(f); } else if(n.endsWith('.html')) { changeSourceType('single'); setSingleFile(f); } else setError('不支持的文件类型'); input.value=''; }} />
            {/** 目录选择器（支持选择文件夹） */}
            {/* eslint-disable-next-line jsx-a11y/aria-proptypes */}
            {/* @ts-ignore webkitdirectory 非标准属性，主流浏览器支持 */}
            <input ref={dirRef} type="file" multiple webkitdirectory="true" style={{display:'none'}} onChange={(e)=>{
              const files = Array.from(e.target.files || []);
              if (!files.length) return;
              const list = files.map((f:any)=> ({ path: normalizePath(f.webkitRelativePath || f.name), file: f as File, selected: true }));
              // 切到目录模式并直接设置清单，避免因切换类型时清空列表的竞态
              setSourceType('dir');
              setSingleFile(null);
              setMultiFiles(list);
              updateMultiStats(list);
              const candidates = list.filter(i=> /(^|\/)index\.html$/i.test(i.path)).map(i=> i.path);
              if (candidates.length === 1) setEntryPath(candidates[0]);
              (e.currentTarget as HTMLInputElement).value = '';
            }} />

            {sourceType === 'zip' && (
              <div className={styles.formGroup}>
                <label>文件清单（ZIP）</label>
                <div className={styles.fileRow}>
                  <div className={styles.hint}>解压后默认全选；可取消不需要上传的文件。</div>
                  {multiFiles.length>0 && (
                    <>
                      <div className={styles.listActions}>
                        <button type="button" className={styles.smallBtn} onClick={()=> selectAll(true)}>全选</button>
                        <button type="button" className={styles.smallBtn} onClick={()=> selectAll(false)}>全不选</button>
                      </div>
                      <div className={styles.fileStats}>
                        共 {multiStats.count} 个文件（{formatBytes(multiStats.bytes)}），已选 {multiStats.selCount}（{formatBytes(multiStats.selBytes)}）{entryPath?`，入口：${entryPath}`:''}
                      </div>
                      {multiFiles.filter(i=> /(^|\/)index\.html$/i.test(i.path)).length > 1 && (
                        <div className={styles.hint}>检测到多个 index.html，请通过“设为入口”指定一个入口文件，并只勾选必要文件。</div>
                      )}
                      <div className={styles.fileList}>
                        {multiFiles.map((it, idx)=> (
                          <div className={styles.fileRowLine} key={it.path}>
                            <input className={styles.fileCheckbox} type="checkbox" checked={it.selected} onChange={(ev)=> toggleSelect(idx, ev.target.checked)} />
                            <span className={styles.filePath}>{it.path}</span>
                            <span className={styles.fileSize}>{formatBytes(it.file.size||0)}</span>
                            {/index\.html$/i.test(it.path) && (
                              <button type="button" className={styles.smallBtn} onClick={()=> setEntryPath(it.path)} title="设为入口">设为入口</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {sourceType === 'single' && singleFile && (
              <div className={styles.formGroup}>
                <label>文件清单（单文件）</label>
                <div className={styles.fileRow}>
                  <div className={styles.fileStats}>已选择 1 个文件：{singleFile.name}（{formatBytes(singleFile.size||0)}）</div>
                  <div className={styles.fileList}>
                    <div className={styles.fileRowLine}>
                      <span className={styles.filePath}>index.html</span>
                      <span className={styles.fileSize}>{formatBytes(singleFile.size||0)}</span>
                      <button type="button" className={styles.smallBtn} onClick={()=> { if (singleRef.current){ singleRef.current.accept='text/html,.html'; singleRef.current.click(); } }}>重新选择</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {sourceType === 'dir' && (
              <div className={styles.formGroup}>
                <label>文件清单（目录）</label>
                <div className={styles.fileRow}>
                  <div className={styles.hint}>默认全选；可取消不需要上传的文件。</div>
                  {multiFiles.length>0 && (
                    <>
                      <div className={styles.listActions}>
                        <button type="button" className={styles.smallBtn} onClick={()=> selectAll(true)}>全选</button>
                        <button type="button" className={styles.smallBtn} onClick={()=> selectAll(false)}>全不选</button>
                      </div>
                      <div className={styles.fileStats}>
                        共 {multiStats.count} 个文件（{formatBytes(multiStats.bytes)}），已选 {multiStats.selCount}（{formatBytes(multiStats.selBytes)}）{entryPath?`，入口：${entryPath}`:''}
                      </div>
                      {multiFiles.filter(i=> /(^|\/)index\.html$/i.test(i.path)).length > 1 && (
                        <div className={styles.hint}>检测到多个 index.html，请通过“设为入口”指定一个入口文件，并只勾选必要文件。</div>
                      )}
                      <div className={styles.fileList}>
                        {multiFiles.map((it, idx)=> (
                          <div className={styles.fileRowLine} key={it.path}>
                            <input className={styles.fileCheckbox} type="checkbox" checked={it.selected} onChange={(ev)=> toggleSelect(idx, ev.target.checked)} />
                            <span className={styles.filePath}>{it.path}</span>
                            <span className={styles.fileSize}>{formatBytes(it.file.size||0)}</span>
                            {/index\.html$/i.test(it.path) && (
                              <button type="button" className={styles.smallBtn} onClick={()=> setEntryPath(it.path)} title="设为入口">设为入口</button>
                            )}
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
                    {lastUploadOk && (
                      <button onClick={() => navigate(`/customif/${appId || appIdFromQuery}`)} className={styles.secondaryBtn}>
                        开始测试
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <FooterArea />
      <UploadProgress
        isOpen={isUploading}
        progress={progress}
        progressText={progressText}
        onCancel={handleCancelUpload}
        completed={lastUploadOk && progress >= 100}
        primaryText="确定"
        secondaryText="开始测试"
        onPrimary={() => { setIsUploading(false); }}
        onSecondary={() => { const id = appId || appIdFromQuery; if (id) navigate(`/customif/${id}`); }}
      />
      {confirmOpen && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmCard}>
            <div className={styles.confirmHeader}>二次确认上传文件</div>
            <div className={styles.confirmBody}>
              <div style={{marginBottom:8}}>将上传已选 <b>{multiStats.selCount}</b> 个文件（{formatBytes(multiStats.selBytes)}）。{entryPath?`入口：${entryPath}`:''}</div>
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
