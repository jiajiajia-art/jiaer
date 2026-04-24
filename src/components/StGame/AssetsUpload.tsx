import React, { useEffect, useRef, useState } from 'react';
import styles from '../../page/CustomIFCreate.module.css';
import { HOST_ADDRESS } from '../../config';
import { authFetch } from '../../api/base';
import UploadProgress from '../CreateGame/UploadProgress';
import toast from 'react-hot-toast';

type MultiItem = { path: string; file: File; selected: boolean };
type CloudAsset = { path: string; url: string; size: number; uploadedAt: string | null };
type CloudSummary = { count: number; bytes: number; latestUploadedAt: string | null };
type CloudAssetsResponse = {
  success: boolean;
  appId: string;
  assetPrefix: string;
  summary?: Partial<CloudSummary> | null;
  assets?: CloudAsset[];
  message?: string;
};

type Props = {
  title: string;
  appId?: string;
  onAppReady?: (appId: string) => void;
  onUploaded?: (assetPrefix: string) => void;
};

const EMPTY_CLOUD_SUMMARY: CloudSummary = {
  count: 0,
  bytes: 0,
  latestUploadedAt: null,
};

const AssetsUpload: React.FC<Props> = ({ title, appId, onAppReady, onUploaded }) => {
  type SourceType = 'zip' | 'dir' | 'files';
  const [sourceType, setSourceType] = useState<SourceType>('zip');
  const [multiFiles, setMultiFiles] = useState<MultiItem[]>([]);
  const [multiStats, setMultiStats] = useState<{ count: number; bytes: number; selCount: number; selBytes: number }>({ count: 0, bytes: 0, selCount: 0, selBytes: 0 });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [lastUploadOk, setLastUploadOk] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const startAtRef = useRef<number | null>(null);
  // 新增：点击唤起选择器（与自定义模式一致）
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const [cloudAssets, setCloudAssets] = useState<CloudAsset[]>([]);
  const [cloudSummary, setCloudSummary] = useState<CloudSummary>(EMPTY_CLOUD_SUMMARY);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [downloadingCloudZip, setDownloadingCloudZip] = useState(false);

  function startFakeProgress(max=90){
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    startAtRef.current = Date.now();
    setProgress(5);
    setProgressText('上传中…');
    const MAX_TIME = 20_000;
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
  function formatBytes(n:number){ if(n<1024) return `${n} B`; if(n<1024*1024) return `${(n/1024).toFixed(1)} KB`; return `${(n/1024/1024).toFixed(1)} MB`; }
  function normalizePath(p:string){ let s=p.replace(/\\+/g,'/'); s=s.replace(/^\/+/,''); const parts:string[]=[]; for(const seg of s.split('/')){ if(seg===''||seg==='.') continue; if(seg==='..'){ parts.pop(); } else { parts.push(seg); } } return parts.join('/'); }
  function toAbsoluteUrl(path: string){ try { return new URL(path, HOST_ADDRESS).toString(); } catch { return path; } }
  function formatDateTime(value: string | null | undefined){
    if (!value) return 'Unknown time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }
  function makeZipFileName(rawTitle: string, currentAppId?: string){
    const fallback = currentAppId ? `${currentAppId}-assets` : 'st-assets';
    const base = (rawTitle || '').trim() || fallback;
    const safe = base
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    return `${safe || fallback}.zip`;
  }
  async function readErrorMessage(response: Response){
    const text = await response.text();
    if (!text) return `Request failed (${response.status})`;
    try {
      const parsed = JSON.parse(text);
      return parsed?.message || parsed?.error || text;
    } catch {
      return text;
    }
  }

  function updateMultiStats(list: MultiItem[]){
    const bytes = list.reduce((a,b)=> a + (b.file.size||0), 0);
    const sel = list.filter(i=> i.selected);
    const selBytes = sel.reduce((a,b)=> a + (b.file.size||0), 0);
    setMultiStats({ count: list.length, bytes, selCount: sel.length, selBytes });
  }

  async function loadCloudAssets(targetAppId?: string){
    const resolvedAppId = String(targetAppId || appId || '').trim();
    if (!resolvedAppId) {
      setCloudAssets([]);
      setCloudSummary(EMPTY_CLOUD_SUMMARY);
      setCloudError('');
      setCloudLoading(false);
      setCloudReady(false);
      return;
    }

    setCloudLoading(true);
    setCloudReady(false);
    setCloudError('');

    try {
      const response = await authFetch(`${HOST_ADDRESS}/api/custom/apps/${resolvedAppId}/assets`, { method: 'GET' });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const json = await response.json() as CloudAssetsResponse;
      const nextAssets = Array.isArray(json.assets) ? json.assets : [];
      const nextSummary = {
        count: Number(json.summary?.count || 0),
        bytes: Number(json.summary?.bytes || 0),
        latestUploadedAt: json.summary?.latestUploadedAt || null,
      };

      setCloudAssets(nextAssets);
      setCloudSummary(nextSummary);
    } catch (err:any) {
      setCloudError(String(err?.message || err || 'Failed to load cloud assets.'));
    } finally {
      setCloudLoading(false);
      setCloudReady(true);
    }
  }

  useEffect(() => {
    void loadCloudAssets();
  }, [appId]);

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
        const f = new File([u8], path.split('/').pop()||'file');
        list.push({ path, file: f, selected: true });
      }
      setSourceType('zip');
      setMultiFiles(list);
      updateMultiStats(list);
    } catch (err:any) {
      setError('解压失败：' + (err?.message || err));
    }
  }

  const onZoneDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
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
        setSourceType('dir');
        setMultiFiles(list as any);
        updateMultiStats(list as any);
        return;
      }
    }
    const file = e.dataTransfer.files?.[0];
    if (file && /\.zip$/i.test(file.name)) return void handleZipFile(file);
    if (file) {
      const list: MultiItem[] = [{ path: file.name, file, selected: true }];
      setSourceType('files');
      setMultiFiles(list);
      updateMultiStats(list);
    }
  };

  // 点击区域触发对应的文件/目录选择
  const onZoneClick = () => {
    if (sourceType === 'dir') {
      dirRef.current?.click();
      return;
    }
    if (fileRef.current) {
      if (sourceType === 'zip') {
        fileRef.current.accept = 'application/zip,.zip';
        fileRef.current.multiple = false;
      } else {
        // 多文件
        fileRef.current.accept = '*/*';
        fileRef.current.multiple = true;
      }
      fileRef.current.click();
    }
  };

  const selectAll = (checked:boolean) => {
    setMultiFiles(prev => {
      const next = prev.map(i => ({...i, selected: checked}));
      updateMultiStats(next);
      return next;
    });
  };

  const downloadCloudAssetsZip = async () => {
    if (!appId || cloudAssets.length === 0 || downloadingCloudZip) return;

    setCloudError('');
    setDownloadingCloudZip(true);

    try {
      await ensureZipLib();
      const zipEntries: Record<string, Uint8Array> = {};

      for (const asset of cloudAssets) {
        const response = await fetch(toAbsoluteUrl(asset.url), { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`Failed to fetch ${asset.path}`);
        }
        zipEntries[asset.path] = new Uint8Array(await response.arrayBuffer());
      }

      // @ts-ignore
      const zipped = (window as any).fflate.zipSync(zipEntries);
      const blob = new Blob([zipped], { type: 'application/zip' });
      const link = document.createElement('a');
      const downloadUrl = URL.createObjectURL(blob);
      link.href = downloadUrl;
      link.download = makeZipFileName(title, appId);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      toast.success('Cloud assets downloaded.');
    } catch (err:any) {
      const message = String(err?.message || err || 'Failed to download cloud assets.');
      setCloudError(message);
      toast.error(message, { duration: 8000 });
    } finally {
      setDownloadingCloudZip(false);
    }
  };

  const doUpload = async () => {
    setError('');
    if (creating) return;
    try {
      if (multiFiles.length === 0) { setError('未选择任何文件'); return; }
      const sel = multiFiles.filter(i=> i.selected);
      if (sel.length === 0) { setError('请至少选择一个文件'); return; }

      setCreating(true);
      setIsUploading(true);
      setLastUploadOk(false);
      startFakeProgress();

      let id = appId;
      if (!id) {
        const resp = await authFetch(`${HOST_ADDRESS}/api/custom/apps/create-empty`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ title: title || '我的游戏', engine: 'ST' }) });
        if (!resp.ok) throw new Error(await resp.text());
        const meta = await resp.json();
        id = meta?.appId || meta?.data?.appId || '';
        if (!id) throw new Error('服务端未返回 appId');
        onAppReady && onAppReady(id);
      }

      const fd = new FormData();
      fd.append('mode', 'multi');
      for(const it of sel){
        fd.append('files[]', it.file, it.path.split('/').pop()||'file');
        fd.append('paths[]', it.path);
      }
      const up = await authFetch(`${HOST_ADDRESS}/api/custom/apps/${id}/assets/upload`, { method:'POST', body: fd });
      if (!up.ok) throw new Error(await up.text());
      const upJson = await up.json();
      const prefix = upJson?.assetPrefix || `${HOST_ADDRESS}/public/custom/apps/${id}/assets`;
      setLastUploadOk(true);
      setProgressText('上传完成');
      setProgress(100);
      stopFakeProgress();
      setIsUploading(true);
      toast.success('素材包上传成功');
      await loadCloudAssets(id);
      onUploaded && onUploaded(prefix);
    } catch (e:any) {
      let msg = String(e?.message || e);
      try { const j = JSON.parse(msg); if (j?.message) msg = j.message; } catch {}
      setError(msg);
      setLastUploadOk(false);
      stopFakeProgress();
      setIsUploading(false);
      toast.error(msg || '上传失败', { duration: 8000 });
    } finally {
      setCreating(false);
    }
  };

  const hasFiles = multiFiles.length > 0;

  return (
    <div className={styles.formGroup}>
      <label>素材包</label>
      <div className={styles.uploaderColumn}>
        <div className={styles.seg}>
          <button type="button" className={`${styles.segBtn} ${sourceType==='zip' ? styles.segBtnActive : ''}`} onClick={()=> setSourceType('zip')}>ZIP 包</button>
          <button type="button" className={`${styles.segBtn} ${sourceType==='dir' ? styles.segBtnActive : ''}`} onClick={()=> setSourceType('dir')}>文件夹</button>
          <button type="button" className={`${styles.segBtn} ${sourceType==='files' ? styles.segBtnActive : ''}`} onClick={()=> setSourceType('files')}>多个文件</button>
        </div>
        <div className={styles.dropZoneLarge}
             onClick={onZoneClick}
             onDragOver={(e)=>{e.preventDefault();}}
             onDragLeave={(e)=>{e.preventDefault();}}
             onDrop={onZoneDrop}
        >
          <div className={styles.dropZoneInner}>
            <div className={styles.dropContent}>
              <h3 className={styles.dropHeading}>拖拽 ZIP/文件夹/文件 到此处</h3>
              <p className={styles.dropHint}>或点击此处选择（支持目录选择）</p>
              <p className={styles.dropHint}>素材将保存在应用的 assets 目录，供正则渲染直接引用</p>
            </div>
          </div>
          <div className={styles.dropListWrapper}>
            <ul className={styles.dropList}>
              <li>示例：上传文件为images/hero.png时，代码中引用 <code>./images/hero.png</code></li>
              <li>建议按 images/、audio/ 等目录整理，路径保持一致</li>
            </ul>
          </div>
        </div>

        {/* 隐藏文件/目录选择器（点击大区域触发） */}
        <input
          ref={fileRef}
          type="file"
          style={{ display: 'none' }}
          onChange={async (e)=>{
            const files = Array.from(e.target.files||[]);
            if (!files.length) { (e.currentTarget as HTMLInputElement).value=''; return; }
            if (sourceType === 'zip') {
              const f = files[0];
              const name = (f.name||'').toLowerCase();
              if (!/\.zip$/i.test(name)) { setError('请选择 ZIP 文件'); (e.currentTarget as HTMLInputElement).value=''; return; }
              await handleZipFile(f);
              (e.currentTarget as HTMLInputElement).value='';
              return;
            }
            // 多文件模式
            const list: MultiItem[] = files.map((f:any)=> ({ path: normalizePath(f.name), file: f as File, selected: true }));
            setSourceType('files');
            setMultiFiles(list);
            updateMultiStats(list);
            (e.currentTarget as HTMLInputElement).value='';
          }}
        />
        {/* eslint-disable-next-line jsx-a11y/aria-proptypes */}
        {/* @ts-ignore webkitdirectory 非标准属性，主流浏览器支持 */}
        <input
          ref={dirRef}
          type="file"
          multiple
          {...({ webkitdirectory: "true" } as React.InputHTMLAttributes<HTMLInputElement>)}
          style={{ display: 'none' }}
          onChange={(e)=>{
            const files = Array.from(e.target.files||[]);
            if (!files.length) return;
            const list: MultiItem[] = files.map((f:any)=> ({ path: normalizePath(f.webkitRelativePath || f.name), file: f as File, selected: true }));
            setSourceType('dir');
            setMultiFiles(list);
            updateMultiStats(list);
            (e.currentTarget as HTMLInputElement).value='';
          }}
        />

        {hasFiles && (
          <div className={styles.fileRow}>
            <div className={styles.listActions}>
              <button type="button" className={styles.smallBtn} onClick={()=> selectAll(true)}>全选</button>
              <button type="button" className={styles.smallBtn} onClick={()=> selectAll(false)}>全不选</button>
            </div>
            <div className={styles.fileStats}>共 {multiStats.count} 个文件（{formatBytes(multiStats.bytes)}），已选 {multiStats.selCount}（{formatBytes(multiStats.selBytes)}）</div>
            <div className={styles.fileList}>
              {multiFiles.map((it, idx)=> (
                <div className={styles.fileRowLine} key={`${it.path}-${idx}`}>
                  <input className={styles.fileCheckbox} type="checkbox" checked={it.selected} onChange={(ev)=> {
                    setMultiFiles(prev => { const next=prev.slice(); next[idx] = {...next[idx], selected: ev.target.checked}; updateMultiStats(next); return next; });
                  }} />
                  <span className={styles.filePath}>{it.path}</span>
                  <span className={styles.fileSize}>{formatBytes(it.file.size||0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.cloudAssetsCard}>
          <div className={styles.cloudAssetsHeader}>
            <div className={styles.cloudAssetsHeading}>
              <div className={styles.cloudAssetsTitle}>Cloud Assets</div>
              <div className={styles.cloudAssetsMeta}>
                {!appId
                  ? 'Cloud assets appear after the first upload.'
                  : `${cloudSummary.count} files • ${formatBytes(cloudSummary.bytes)}${cloudSummary.latestUploadedAt ? ` • Updated ${formatDateTime(cloudSummary.latestUploadedAt)}` : ''}`}
              </div>
            </div>
            <div className={styles.cloudAssetsActions}>
              <button
                type="button"
                className={styles.smallBtn}
                onClick={() => void loadCloudAssets()}
                disabled={!appId || cloudLoading || downloadingCloudZip}
              >
                {cloudLoading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                type="button"
                className={styles.smallBtn}
                onClick={() => void downloadCloudAssetsZip()}
                disabled={!appId || cloudAssets.length === 0 || cloudLoading || downloadingCloudZip}
              >
                {downloadingCloudZip ? 'Preparing ZIP...' : 'Download ZIP'}
              </button>
            </div>
          </div>

          {!appId ? (
            <div className={styles.cloudAssetsEmpty}>Upload once to create the cloud asset folder for this project.</div>
          ) : cloudLoading && !cloudReady ? (
            <div className={styles.cloudAssetsEmpty}>Loading cloud assets...</div>
          ) : cloudAssets.length > 0 ? (
            <div className={styles.fileList}>
              {cloudAssets.map((asset) => (
                <div className={styles.cloudAssetRow} key={asset.path}>
                  <span className={styles.filePath}>{asset.path}</span>
                  <span className={styles.cloudAssetMetaLine}>
                    {formatBytes(asset.size)}
                    {asset.uploadedAt ? ` • ${formatDateTime(asset.uploadedAt)}` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.cloudAssetsEmpty}>No cloud assets found for this project yet.</div>
          )}

          {cloudError && (
            <div className={styles.error}>{cloudError}</div>
          )}
        </div>

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        <div className={styles.actions}>
          <button onClick={doUpload} disabled={creating} className={styles.primaryBtn}>
            {creating ? '上传中…' : '上传素材包'}
          </button>
        </div>
      </div>

      <UploadProgress
        isOpen={isUploading}
        progress={progress}
        progressText={progressText}
        onCancel={() => {
          if (abortRef.current) { try { abortRef.current.abort(); } catch {} abortRef.current = null; }
          stopFakeProgress(); setIsUploading(false); setCreating(false); setProgress(0); setProgressText('');
        }}
        completed={lastUploadOk && progress >= 100}
        primaryText="确定"
        onPrimary={() => { setIsUploading(false); }}
      />
    </div>
  );
};

export default AssetsUpload;
