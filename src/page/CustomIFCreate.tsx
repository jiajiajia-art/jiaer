import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Layout/Navbar';
import { HOST_ADDRESS } from '../config';
import { authFetch } from '../api/base';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './CustomIFCreate.module.css';
import UploadProgress from '../components/CreateGame/UploadProgress';
import toast from 'react-hot-toast';
import getGameDataApi from '../api/home/getGameData';
import gameTagsApi from '../api/gameTags/gameTagsApi';
import { flattenThemeTags, useLocalizedThemeTags, type FlatThemeTag } from '../utils/themeTags';
import ContentAudienceField from '../components/ContentAudienceField';
import { isValidContentAudience, type ContentAudience } from '../utils/contentAudience';
import SimpleRichTextEditor from '../components/Common/SimpleRichTextEditor';
import EditorApi from '../api/galgame/EditorData';
import {
  NOVEL_DESCRIPTION_MAX_LENGTH,
  normalizeDescriptionForSave,
  toEditorHtml,
} from '../utils/gameDescriptionHtml';

const CustomIFCreate: React.FC = () => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // 版本号已由服务端管理，无需前端填写
  const [manifestText, setManifestText] = useState('');
  const [creating, setCreating] = useState(false);
  const [appId, setAppId] = useState<string>('');
  const [, setEntryUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [availableThemeTags, setAvailableThemeTags] = useState<FlatThemeTag[]>([]);
  const [selectedThemeTagIds, setSelectedThemeTagIds] = useState<number[]>([]);
  const [themeTagError, setThemeTagError] = useState<string>('');
  const [selectedAudienceType, setSelectedAudienceType] = useState<ContentAudience | null>(null);
  const [audienceError, setAudienceError] = useState<string>('');
  const displayThemeTags = useLocalizedThemeTags(availableThemeTags);
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
    let cancelled = false;

    const fetchThemeTags = async () => {
      try {
        const resp = await gameTagsApi.getGameTagsTree();
        if (!resp.data?.success || cancelled) return;
        setAvailableThemeTags(flattenThemeTags(resp.data.data || []));
      } catch (err) {
        console.error('加载作品标签失败:', err);
      }
    };

    void fetchThemeTags();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const loadGameTitle = async () => {
      if (!isEditMode || !appIdFromQuery) return;
      try {
        const resp = await getGameDataApi.getGameDetail({ fileId: appIdFromQuery });
        const data = resp.data?.data;
        if (data && typeof data.title === 'string') {
          setTitle(data.title);
        }
        if (data && typeof data.description === 'string') {
          setDescription(toEditorHtml(data.description));
        }
        const existingTagIds = Array.isArray(data?.theme_tag_ids)
          ? (data.theme_tag_ids || [])
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)
          : [];
        setSelectedThemeTagIds(existingTagIds.slice(0, 2));
        setSelectedAudienceType(isValidContentAudience(data?.audience_type) ? data.audience_type : null);
        setAudienceError('');
      } catch (error) {
        console.error('加载游戏信息失败:', error);
        // 失败时不打断流程，仅提示
        toast.error(t('customIFCreate.loadTitleFailed'));
      }
    };

    void loadGameTitle();
  }, [isEditMode, appIdFromQuery, t]);


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
  const changeSourceType = (nextType: SourceType) => {
    setError('');
    setSourceType(nextType);
    // 切换类型时重置，避免混淆
    setSingleFile(null);
    setMultiFiles([]);
    setEntryPath('');
    setMultiStats({ count: 0, bytes: 0, selCount: 0, selBytes: 0 });
  };

  const handleThemeTagToggle = (tagId: number) => {
    setSelectedThemeTagIds((prev) => {
      if (prev.includes(tagId)) {
        const next = prev.filter((id) => id !== tagId);
        if (next.length > 0) {
          setThemeTagError('');
        }
        return next;
      }
      if (prev.length >= 2) {
        toast.error(t('createGame.themeTagMax2'));
        return prev;
      }
      setThemeTagError('');
      return [...prev, tagId];
    });
  };

  const handleAudienceTypeChange = (next: ContentAudience) => {
    setSelectedAudienceType(next);
    setAudienceError('');
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
    setProgressText(t('customIFCreate.uploading'));
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

  const ensureAppIdReady = async (): Promise<string> => {
    let id = appIdFromQuery || appId;
    if (id) return id;
    const resp = await authFetch(`${HOST_ADDRESS}/api/custom/apps/create-empty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title || t('customIFCreate.defaultGameTitle') }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const meta = await resp.json();
    id = meta?.appId || meta?.data?.appId || '';
    if (!id) throw new Error(t('customIFCreate.createAppNoId'));
    setAppId(id);
    try {
      localStorage.setItem(DRAFT_KEY, id);
    } catch {}
    return id;
  };

  const handleUploadDescImage = async (file: File): Promise<string> => {
    const id = await ensureAppIdReady();
    try {
      const resp = await EditorApi.uploadDescImage(id, file);
      const url = resp.data?.data?.url;
      if (!resp.data?.success || !url) {
        throw new Error(resp.data?.message || t('customIFCreate.descImageUploadFailed'));
      }
      return url.startsWith('/') ? url : `/${url}`;
    } catch (err: unknown) {
      const axiosMsg = (err as { response?: { data?: { message?: string }; status?: number } })?.response?.data?.message;
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (axiosMsg) throw new Error(axiosMsg);
      if (status === 404) {
        throw new Error(t('customIFCreate.descImageApiMissing', {
          defaultValue: '简介图片上传接口不可用（404），请确认后端已部署 upload-desc-image',
        }));
      }
      throw err instanceof Error ? err : new Error(String(err || t('customIFCreate.descImageUploadFailed')));
    }
  };

  /** 配图写入编辑器后，同步落库 games.description（否则详情页仍是旧纯文本） */
  const persistDescriptionAfterImage = async (html: string) => {
    try {
      const id = await ensureAppIdReady();
      const descriptionToSave = normalizeDescriptionForSave(html, HOST_ADDRESS);
      const metaResp = await authFetch(`${HOST_ADDRESS}/api/custom/apps/${id}/meta/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || t('customIFCreate.defaultGameTitle'),
          description: descriptionToSave,
        }),
      });
      if (!metaResp.ok) {
        const text = await metaResp.text();
        throw new Error(text || t('customIFCreate.descPersistFailed'));
      }
      setDescription(descriptionToSave);
      toast.success(t('customIFCreate.descPersistSuccess'), { duration: 2500 });
    } catch (err: unknown) {
      console.error('persist description after image failed:', err);
      toast.error(
        (err instanceof Error ? err.message : '') || t('customIFCreate.descPersistFailed'),
        { duration: 5000 },
      );
    }
  };

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
      setError(t('customIFCreate.unzipFailed', { message: String(err?.message || err) }));
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
  const doUpload = async (opts?: { metaOnly?: boolean }) => {
    setError('');
    if (creating) return;
    const metaOnly = !!opts?.metaOnly;
    try {
      // 实现作品分类与作品标签必填校验
      if (!isValidContentAudience(selectedAudienceType)) {
        setAudienceError(t('createGame.contentAudienceRequired'));
        toast.error(t('createGame.contentAudienceRequired'));
        return;
      }
      setAudienceError('');
      if (selectedThemeTagIds.length < 1 || selectedThemeTagIds.length > 2) {
        setThemeTagError(t('createGame.themeTagRequired'));
        toast.error(t('createGame.themeTagRequiredMax2'));
        return;
      }
      setThemeTagError('');

      if (!metaOnly) {
        if (sourceType === 'single') {
          const file = singleFile || fileRef.current?.files?.[0];
          if (!file) {
            setError(t('customIFCreate.uploadIndexHtml'));
            return;
          }
        } else {
          if (multiFiles.length === 0) {
            setError(t('customIFCreate.noFilesSelected'));
            return;
          }
          const sel = multiFiles.filter((item) => item.selected);
          if (sel.length === 0) {
            setError(t('customIFCreate.selectAtLeastOneFile'));
            return;
          }
          if (entryPath && !sel.some((item) => item.path === entryPath)) {
            setError(t('customIFCreate.entryNotSelected', { path: entryPath }));
            return;
          }
        }
      }

      setCreating(true);
      setIsUploading(true);
      setLastUploadOk(false);
      startFakeProgress();

      let id = await ensureAppIdReady();
      const descriptionToSave = normalizeDescriptionForSave(description, HOST_ADDRESS);

      if (metaOnly) {
        const metaResp = await authFetch(`${HOST_ADDRESS}/api/custom/apps/${id}/meta/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim() || t('customIFCreate.defaultGameTitle'),
            description: descriptionToSave,
          }),
        });
        if (!metaResp.ok) throw new Error(await metaResp.text());
      } else {
        const fd = new FormData();
        if (title.trim()) {
          fd.append('title', title.trim());
        }
        fd.append('description', descriptionToSave);
        if (manifestText.trim()) {
          fd.append('manifest', manifestText);
        }

        if (sourceType === 'single') {
          const file = (singleFile || fileRef.current?.files?.[0])!;
          if ((file.size || 0) <= 0) {
            throw new Error(t('customIFCreate.indexHtmlEmpty'));
          }
          fd.append('index', file, file.name || 'index.html');
        } else {
          fd.append('mode', 'multi');
          if (entryPath) {
            fd.append('entryPath', entryPath);
          }
          for (const it of multiFiles.filter((item) => item.selected)) {
            fd.append('files[]', it.file, it.path.split('/').pop() || 'file');
            fd.append('paths[]', it.path);
          }
        }

        abortRef.current = new AbortController();
        const up = await authFetch(`${HOST_ADDRESS}/api/custom/apps/${id}/ui/upload`, {
          method: 'POST',
          body: fd,
          signal: abortRef.current.signal,
        });
        if (!up.ok) throw new Error(await up.text());

        const upJson = await up.json();
        console.log('[CustomIF upload]', upJson);
        const entry = upJson?.entry || upJson?.entryUrl || `/public/custom/apps/${id}/ui/index.html`;
        setEntryUrl(entry);
      }

      await gameTagsApi.setGameTagsForGame({
        fileId: String(id),
        tagIds: selectedThemeTagIds,
        audienceType: selectedAudienceType,
      });

      setLastUploadOk(true);
      setProgressText(t('customIFCreate.uploadComplete'));
      setProgress(100);
      stopFakeProgress();
      setIsUploading(true);
      toast.success(metaOnly ? t('customIFCreate.saveSuccess') : t('customIFCreate.uploadSuccess'));
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
    } catch (e: any) {
      let msg = String(e?.message || e);
      try {
        const j = JSON.parse(msg);
        if (j?.message) msg = j.message;
      } catch {}
      setError(msg);
      setLastUploadOk(false);
      stopFakeProgress();
      setIsUploading(false);
      toast.error(msg || t('customIFCreate.uploadFailed'), { duration: 8000 });
    } finally {
      setCreating(false);
      setConfirmOpen(false);
    }
  };
const handleCreate = () => {
    setError('');
    if (!isValidContentAudience(selectedAudienceType)) {
      setAudienceError(t('createGame.contentAudienceRequired'));
      toast.error(t('createGame.contentAudienceRequired'));
      return;
    }
    setAudienceError('');
    if (selectedThemeTagIds.length < 1 || selectedThemeTagIds.length > 2) {
      setThemeTagError(t('createGame.themeTagRequired'));
      toast.error(t('createGame.themeTagRequiredMax2'));
      return;
    }
    setThemeTagError('');

    const hasSingle = !!(singleFile || fileRef.current?.files?.[0]);
    const hasMulti = multiFiles.length > 0;
    if (isEditMode && !hasSingle && !hasMulti) {
      void doUpload({ metaOnly: true });
      return;
    }

    if (sourceType === 'single') return void doUpload();
    if (multiFiles.length === 0) { setError(t('customIFCreate.selectZipOrDirFirst')); return; }
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
    toast(t('customIFCreate.uploadCancelled'), { duration: 4000 });
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
            {/* 功能注释：对齐 AVG 效果图顶栏——返回 + 居中标题 + 右侧测试，去掉落地页式大标题/长说明 */}
            <header className={styles.pageHeader}>
              <button
                type="button"
                className={styles.pageBack}
                onClick={() => navigate('/profile')}
                aria-label={t('customIFCreate.backAria')}
              >
                ‹
              </button>
              <h1 className={styles.pageTitle}>
                {isEditMode ? t('customIFCreate.editTitle') : t('customIFCreate.createTitle')}
              </h1>
              <div className={styles.pageHeaderSlot}>
                {(isEditMode || lastUploadOk) && (appId || appIdFromQuery) ? (
                  <button
                    type="button"
                    className={styles.pageTest}
                    onClick={() => navigate(`/customif/${appId || appIdFromQuery}`)}
                  >
                    {t('customIFCreate.headerTest')}
                  </button>
                ) : null}
              </div>
            </header>

            <section className={styles.formCard}>
              <div className={styles.formCardHead}>
                <h2 className={styles.formCardTitle}>{t('customIFCreate.basicInfoTitle')}</h2>
                <p className={styles.formCardDesc}>{t('customIFCreate.basicInfoDesc')}</p>
              </div>

              <div className={styles.fieldBlock}>
                <label htmlFor="title" className={styles.fieldLabel}>{t('customIFCreate.titleLabel')}</label>
                <input
                  id="title"
                  className={styles.textInput}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('customIFCreate.titlePlaceholder')}
                  autoComplete="off"
                />
              </div>

              <div className={styles.fieldBlock}>
                <label className={styles.fieldLabel}>{t('customIFCreate.descriptionLabel')}</label>
                <div className={styles.descriptionEditor}>
                  <SimpleRichTextEditor
                    className={styles.richEditorDark}
                    value={description}
                    onChange={setDescription}
                    maxPlainLength={NOVEL_DESCRIPTION_MAX_LENGTH}
                    placeholder={t('customIFCreate.descriptionPlaceholder', { max: NOVEL_DESCRIPTION_MAX_LENGTH })}
                    onUploadImage={handleUploadDescImage}
                    onAfterImageInsert={(html) => {
                      void persistDescriptionAfterImage(html);
                    }}
                    disabled={creating || isUploading}
                  />
                </div>
              </div>

              <div className={styles.fieldBlock}>
                {/* 功能注释：作品分类在作品标签之前，必选且只能选一项 */}
                <ContentAudienceField
                  value={selectedAudienceType}
                  onChange={handleAudienceTypeChange}
                  required
                  error={audienceError}
                  disabled={creating || isUploading}
                />
                {/* 功能注释：对齐图1——标题+必填星号，说明在下方；标签为描边芯片而非纯文字 */}
                <div className={styles.themeTagsHead}>
                  <label className={styles.fieldLabel}>
                    {t('createGame.gameTags')}
                    <span className={styles.requiredMark} aria-hidden="true">*</span>
                  </label>
                  <span className={styles.themeTagHint}>{t('createGame.min1Max2Tags')}</span>
                </div>
                <div className={styles.themeTagsPanel}>
                  <div className={styles.themeTagsWrap}>
                    {displayThemeTags.map((tag) => {
                      const active = selectedThemeTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          className={`${styles.themeTagChip} ${active ? styles.themeTagChipActive : ''}`}
                          onClick={() => handleThemeTagToggle(tag.id)}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                  {themeTagError && <div className={styles.themeTagError}>{themeTagError}</div>}
                </div>
              </div>
            </section>

            {/* 版本号输入已移除：由服务端管理当前激活版本 */}

            {/* 简化：直接从类型切换/拖放区开始，去掉与效果图不符的「上传内容」标题块 */}
            <section className={styles.formCard}>
              <div className={styles.fieldBlock}>
                <div className={styles.uploaderColumn}>
                  {/* 文件类型选择器：切换后渲染对应的上传区域与校验 */}
                  <div className={styles.seg}>
                    <button type="button" className={`${styles.segBtn} ${sourceType==='single' ? styles.segBtnActive : ''}`} onClick={()=> changeSourceType('single')}>{t('customIFCreate.sourceSingle')}</button>
                    <button type="button" className={`${styles.segBtn} ${sourceType==='zip' ? styles.segBtnActive : ''}`} onClick={()=> changeSourceType('zip')}>{t('customIFCreate.sourceZip')}</button>
                    <button type="button" className={`${styles.segBtn} ${sourceType==='dir' ? styles.segBtnActive : ''}`} onClick={()=> changeSourceType('dir')}>{t('customIFCreate.sourceDir')}</button>
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
                       else { setError(t('customIFCreate.unsupportedDrop')); }
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
                        <div className={styles.dropHeading}>{t('customIFCreate.dropHeading')}</div>
                        <div className={styles.dropHint}>{t('customIFCreate.dropHint')}</div>
                      </div>
                    </div>

                    <div className={styles.dropListWrapper}>
                      <ul className={styles.dropList}>
                        <li>{t('customIFCreate.requirement1')}</li>
                        <li>{t('customIFCreate.requirement2')}</li>
                        <li>{t('customIFCreate.requirement3')}</li>
                        <li>{t('customIFCreate.requirement4')}</li>
                        <li>{t('customIFCreate.requirement5')}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 隐藏文件选择器（点击大区域触发） */}
              <input id="index" ref={singleRef} type="file" accept="text/html,.html,.zip,application/zip" className={styles.fileInput} style={{display:'none'}} onChange={async (e)=>{ const input=e.currentTarget; const f=e.target.files?.[0]; if(!f){ input.value=''; return; } const n=(f.name||'').toLowerCase(); if(n.endsWith('.zip')) { setSingleFile(null); await handleZipFile(f); } else if(n.endsWith('.html')) { changeSourceType('single'); setSingleFile(f); } else setError(t('customIFCreate.unsupportedFileType')); input.value=''; }} />
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
                <div className={styles.fieldBlock}>
                  <label className={styles.fieldLabel}>{t('customIFCreate.zipFileList')}</label>
                  <div className={styles.fileRow}>
                    <div className={styles.hint}>{t('customIFCreate.zipHint')}</div>
                    {multiFiles.length>0 && (
                      <>
                        <div className={styles.listActions}>
                          <button type="button" className={styles.smallBtn} onClick={()=> selectAll(true)}>{t('customIFCreate.selectAll')}</button>
                          <button type="button" className={styles.smallBtn} onClick={()=> selectAll(false)}>{t('customIFCreate.selectNone')}</button>
                        </div>
                        <div className={styles.fileStats}>
                          {entryPath
                            ? t('customIFCreate.fileStatsWithEntry', {
                              count: multiStats.count,
                              size: formatBytes(multiStats.bytes),
                              selectedCount: multiStats.selCount,
                              selectedSize: formatBytes(multiStats.selBytes),
                              entry: entryPath,
                            })
                            : t('customIFCreate.fileStats', {
                              count: multiStats.count,
                              size: formatBytes(multiStats.bytes),
                              selectedCount: multiStats.selCount,
                              selectedSize: formatBytes(multiStats.selBytes),
                            })}
                        </div>
                        {multiFiles.filter(i=> /(^|\/)index\.html$/i.test(i.path)).length > 1 && (
                          <div className={styles.hint}>{t('customIFCreate.multipleIndexHtml')}</div>
                        )}
                        <div className={styles.fileList}>
                          {multiFiles.map((it, idx)=> (
                            <div className={styles.fileRowLine} key={it.path}>
                              <input className={styles.fileCheckbox} type="checkbox" checked={it.selected} onChange={(ev)=> toggleSelect(idx, ev.target.checked)} />
                              <span className={styles.filePath}>{it.path}</span>
                              <span className={styles.fileSize}>{formatBytes(it.file.size||0)}</span>
                              {/index\.html$/i.test(it.path) && (
                                <button type="button" className={styles.smallBtn} onClick={()=> setEntryPath(it.path)} title={t('customIFCreate.setAsEntry')}>{t('customIFCreate.setAsEntry')}</button>
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
                <div className={styles.fieldBlock}>
                  <label className={styles.fieldLabel}>{t('customIFCreate.singleFileList')}</label>
                  <div className={styles.fileRow}>
                    <div className={styles.fileStats}>{t('customIFCreate.singleFileSelected', { name: singleFile.name, size: formatBytes(singleFile.size || 0) })}</div>
                    <div className={styles.fileList}>
                      <div className={styles.fileRowLine}>
                        <span className={styles.filePath}>index.html</span>
                        <span className={styles.fileSize}>{formatBytes(singleFile.size||0)}</span>
                        <button type="button" className={styles.smallBtn} onClick={()=> { if (singleRef.current){ singleRef.current.accept='text/html,.html'; singleRef.current.click(); } }}>{t('customIFCreate.reselect')}</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {sourceType === 'dir' && (
                <div className={styles.fieldBlock}>
                  <label className={styles.fieldLabel}>{t('customIFCreate.dirFileList')}</label>
                  <div className={styles.fileRow}>
                    <div className={styles.hint}>{t('customIFCreate.dirHint')}</div>
                    {multiFiles.length>0 && (
                      <>
                        <div className={styles.listActions}>
                          <button type="button" className={styles.smallBtn} onClick={()=> selectAll(true)}>{t('customIFCreate.selectAll')}</button>
                          <button type="button" className={styles.smallBtn} onClick={()=> selectAll(false)}>{t('customIFCreate.selectNone')}</button>
                        </div>
                        <div className={styles.fileStats}>
                          {entryPath
                            ? t('customIFCreate.fileStatsWithEntry', {
                              count: multiStats.count,
                              size: formatBytes(multiStats.bytes),
                              selectedCount: multiStats.selCount,
                              selectedSize: formatBytes(multiStats.selBytes),
                              entry: entryPath,
                            })
                            : t('customIFCreate.fileStats', {
                              count: multiStats.count,
                              size: formatBytes(multiStats.bytes),
                              selectedCount: multiStats.selCount,
                              selectedSize: formatBytes(multiStats.selBytes),
                            })}
                        </div>
                        {multiFiles.filter(i=> /(^|\/)index\.html$/i.test(i.path)).length > 1 && (
                          <div className={styles.hint}>{t('customIFCreate.multipleIndexHtml')}</div>
                        )}
                        <div className={styles.fileList}>
                          {multiFiles.map((it, idx)=> (
                            <div className={styles.fileRowLine} key={it.path}>
                              <input className={styles.fileCheckbox} type="checkbox" checked={it.selected} onChange={(ev)=> toggleSelect(idx, ev.target.checked)} />
                              <span className={styles.filePath}>{it.path}</span>
                              <span className={styles.fileSize}>{formatBytes(it.file.size||0)}</span>
                              {/index\.html$/i.test(it.path) && (
                                <button type="button" className={styles.smallBtn} onClick={()=> setEntryPath(it.path)} title={t('customIFCreate.setAsEntry')}>{t('customIFCreate.setAsEntry')}</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.fieldBlock}>
                <div className={styles.fieldLabelRow}>
                  <label htmlFor="manifest" className={styles.fieldLabel}>{t('customIFCreate.manifestLabel')}</label>
                  {/* 功能注释：对齐 AVG 效果图 Manifest 行右侧「一键清空」小酒红胶囊 */}
                  <button
                    type="button"
                    className={styles.clearPill}
                    onClick={() => setManifestText('')}
                  >
                    {t('customIFCreate.clearAll')}
                  </button>
                </div>
                <textarea
                  id="manifest"
                  className={styles.textarea}
                  value={manifestText}
                  onChange={(e) => setManifestText(e.target.value)}
                  placeholder='{"allowedModels":["claude-3-5-sonnet-20240620"]}'
                  rows={6}
                />
              </div>
            </section>

            {error && (
              <div className={styles.formErrorBanner}>{error}</div>
            )}

            <div className={styles.formFooter}>
              <div className={styles.actions}>
                {(() => {
                  const hasPendingFiles = !!(singleFile || fileRef.current?.files?.[0] || multiFiles.length > 0);
                  const isMetaSave = isEditMode && !hasPendingFiles;
                  return (
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={creating}
                      className={`${styles.primaryBtn}${isMetaSave ? ` ${styles.primaryBtnMeta}` : ''}`}
                    >
                      {creating
                        ? (isEditMode ? t('customIFCreate.uploadingEdit') : t('customIFCreate.creating'))
                        : (isEditMode
                          ? (hasPendingFiles
                            ? t('customIFCreate.uploadNewVersion')
                            : t('customIFCreate.saveMeta'))
                          : t('customIFCreate.createAndUpload'))}
                    </button>
                  );
                })()}
                {(appId || appIdFromQuery) && lastUploadOk && (
                  <button
                    type="button"
                    onClick={() => navigate(`/customif/${appId || appIdFromQuery}`)}
                    className={styles.secondaryBtn}
                  >
                    {t('customIFCreate.startTest')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <UploadProgress
        isOpen={isUploading}
        progress={progress}
        progressText={progressText}
        onCancel={handleCancelUpload}
        completed={lastUploadOk && progress >= 100}
        primaryText={t('customIFCreate.confirm')}
        secondaryText={t('customIFCreate.startTest')}
        onPrimary={() => { setIsUploading(false); }}
      />
      {confirmOpen && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmCard}>
            <div className={styles.confirmHeader}>{t('customIFCreate.confirmUploadTitle')}</div>
            <div className={styles.confirmBody}>
              <div style={{marginBottom:8}}>
                {entryPath
                  ? t('customIFCreate.confirmUploadBodyWithEntry', {
                    count: multiStats.selCount,
                    size: formatBytes(multiStats.selBytes),
                    entry: entryPath,
                  })
                  : t('customIFCreate.confirmUploadBody', {
                    count: multiStats.selCount,
                    size: formatBytes(multiStats.selBytes),
                  })}
              </div>
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
              <button className={styles.btnGhost} onClick={()=> setConfirmOpen(false)}>{t('common.cancel')}</button>
              <button className={styles.btnPrimary} onClick={() => void doUpload()} disabled={creating || multiStats.selCount===0}>{t('customIFCreate.confirmUpload')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomIFCreate;
