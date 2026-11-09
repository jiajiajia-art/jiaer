/**
 * 手机应用（原「创作应用」收编进「创作游戏」二级）：
 * 填需求 → AI 对话生成草稿字段 → 保存草稿 → 上架；保存时把应用草稿打成 phone_app 包上传组件商店（应用运行在平台 SDK 上）。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AppPageShell from '../components/Layout/AppPageShell';
import { useAuthStore } from '../store/useAuthStore';
import { isOperatorRole } from '../utils/userRoles';
import { getImageUrl } from '../utils/constants';
import { HOST_ADDRESS } from '../config';
import {
  PLATFORM_APP_TYPE_OPTIONS,
  platformAppsApi,
  type PlatformApp,
  type PlatformAppType,
} from '../api/platform/platformAppsApi';
import { playModStoreApi } from '../api/playMod/playModApi';
import { buildPhoneAppKkmodPackage } from '../lib/platformAppKkmod';
import {
  applyPhoneAppAiPatch,
  buildPhoneAppSystemPrompt,
  extractPhoneAppJsonPatch,
  stripPhoneAppJsonFence,
  type PhoneAppAiTurn,
  type PhoneAppFormDraft,
  type PhoneAppFormType,
} from '../lib/phoneAppAiChat';
import styles from './CreatePlatformApp.module.css';

type FormState = Omit<PhoneAppFormDraft, 'type'> & {
  icon: string;
  previews: string[];
  type: PlatformAppType;
};

const emptyForm = (): FormState => ({
  name: '',
  icon: '',
  previews: [],
  summary: '',
  category: '',
  type: 'browse',
  contentText: '',
});

async function completePhoneAppChat(
  token: string,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const res = await fetch(`${HOST_ADDRESS}/api/romance/play/complete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, max_tokens: 4000 }),
  });
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    data?: { text?: string };
  } | null;
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `对话失败（${res.status}）`);
  }
  const text = String(json?.data?.text || '').trim();
  if (!text) throw new Error('模型返回空内容');
  return text;
}

const CreatePlatformApp: React.FC = () => {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.user?.token);
  const userCode = useAuthStore((s) => s.user?.user?.userCode);
  const role = useAuthStore((s) => s.user?.user?.role);
  const isStaff = isOperatorRole(role);
  const [mine, setMine] = useState<PlatformApp[]>([]);
  const [published, setPublished] = useState<PlatformApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [brief, setBrief] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [turns, setTurns] = useState<PhoneAppAiTurn[]>([
    {
      role: 'assistant',
      text: '先写一两句需求（或直接聊天），例如「做一个二手闲置浏览页，分类生活，展示商品列表文案」。我会生成名称、说明、类型和内容草稿；满意后保存草稿，再上传应用草稿到组件商店（应用运行在平台 SDK 上）。',
    },
  ]);
  const [chatBusy, setChatBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadMine = useCallback(async () => {
    if (!token) {
      setMine([]);
      setPublished([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await platformAppsApi.listMine(token);
      if (!res.success) throw new Error(res.message || '加载失败');
      setMine(Array.isArray(res.data) ? res.data : []);
      if (isStaff) {
        const pub = await platformAppsApi.listPublished(token);
        if (pub.success && Array.isArray(pub.data)) setPublished(pub.data);
      } else {
        setPublished([]);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '加载我的应用失败');
    } finally {
      setLoading(false);
    }
  }, [token, isStaff]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns, chatBusy]);

  const uploadImage = async (file: File | undefined): Promise<string | null> => {
    if (!file || !token) return null;
    const res = await platformAppsApi.upload(token, file);
    if (!res.success || !res.data?.imageUrl) {
      toast.error(res.message || '上传失败');
      return null;
    }
    return String(res.data.imageUrl);
  };

  const onPickIcon = async (file: File | undefined) => {
    const url = await uploadImage(file);
    if (url) setForm((f) => ({ ...f, icon: url }));
  };

  const onPickPreview = async (file: File | undefined) => {
    const url = await uploadImage(file);
    if (url) setForm((f) => ({ ...f, previews: [...f.previews, url].slice(0, 12) }));
  };

  const draftFields = (): PhoneAppFormDraft => ({
    name: form.name,
    summary: form.summary,
    category: form.category,
    type: form.type as PhoneAppFormType,
    contentText: form.contentText,
  });

  const sendChat = async (raw: string) => {
    const text = raw.trim();
    if (!text || chatBusy) return;
    if (!token) {
      toast.error('请先登录');
      navigate('/profile');
      return;
    }
    const userLine = brief.trim() ? `【需求】${brief.trim()}\n${text}` : text;
    const hist: PhoneAppAiTurn[] = [...turns, { role: 'user', text: userLine }];
    setTurns(hist);
    setChatInput('');
    setChatBusy(true);
    try {
      const messages = [
        { role: 'system' as const, content: buildPhoneAppSystemPrompt(draftFields()) },
        ...hist.slice(-10).map((t) => ({ role: t.role, content: t.text })),
      ];
      const reply = await completePhoneAppChat(token, messages);
      const patch = extractPhoneAppJsonPatch(reply);
      const next = applyPhoneAppAiPatch(draftFields(), patch);
      setForm((f) => ({ ...f, ...next }));
      const shown = stripPhoneAppJsonFence(reply) || (patch ? '已按对话更新草稿字段，可继续细调或保存。' : reply);
      setTurns([...hist, { role: 'assistant', text: shown }]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '对话失败');
      setTurns(turns);
    } finally {
      setChatBusy(false);
    }
  };

  const startEdit = (app: PlatformApp) => {
    setEditingId(app.appId);
    const contentText =
      typeof app.content === 'string'
        ? app.content
        : app.content && typeof app.content === 'object' && 'text' in (app.content as object)
          ? String((app.content as { text?: string }).text || '')
          : app.content
            ? JSON.stringify(app.content)
            : '';
    setForm({
      name: app.name || '',
      icon: app.icon || '',
      previews: Array.isArray(app.previews) ? app.previews : [],
      summary: app.summary || '',
      category: app.category || '',
      type: (PLATFORM_APP_TYPE_OPTIONS.some((o) => o.value === app.type)
        ? app.type
        : 'browse') as PlatformAppType,
      contentText,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  /** 功能注释：草稿写入平台应用表后，打 phone_app .kkmod 进组件商店私有测试。 */
  const uploadPhoneAppDraft = async (app: PlatformApp) => {
    if (!token) return;
    setUploadBusy(true);
    try {
      const pkg = buildPhoneAppKkmodPackage({
        appId: app.appId,
        name: app.name,
        summary: app.summary,
        icon: app.icon,
        type: String(app.type || 'browse'),
        category: app.category,
        content: app.content,
      });
      const res = await playModStoreApi.uploadKkmod(token, {
        filename: `${pkg.manifest.slug}.kkmod`,
        package: pkg,
        engineVersion: '1.0.0',
      });
      if (!res.success && !res.ok) {
        throw new Error(res.message || res.data?.message || '应用草稿上传失败');
      }
      toast.success(res.data?.message || res.message || '已上传应用草稿（组件商店私有测试）');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '应用草稿上传失败');
    } finally {
      setUploadBusy(false);
    }
  };

  const save = async () => {
    if (!token) {
      toast.error('请先登录');
      navigate('/profile');
      return;
    }
    if (!form.name.trim()) {
      toast.error('请填写应用名称（可先对话生成）');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        icon: form.icon,
        previews: form.previews,
        summary: form.summary.trim(),
        category: form.category.trim(),
        type: form.type,
        content: { text: form.contentText },
      };
      const res = editingId
        ? await platformAppsApi.update(token, editingId, body)
        : await platformAppsApi.create(token, body);
      if (!res.success) throw new Error(res.message || '保存失败');
      const saved = (res.data || {}) as PlatformApp;
      const appId = saved.appId || editingId;
      toast.success(editingId ? '已保存' : '已保存为草稿');
      if (appId) {
        await uploadPhoneAppDraft({
          appId,
          authorId: saved.authorId || userCode || '',
          authorName: saved.authorName || '',
          name: body.name,
          icon: body.icon || '',
          previews: body.previews || [],
          summary: body.summary || '',
          category: body.category || '',
          type: body.type,
          content: body.content,
          status: saved.status || 'draft',
        });
      }
      resetForm();
      await loadMine();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const publish = async (appId: string) => {
    if (!token) return;
    try {
      const res = await platformAppsApi.publish(token, appId);
      if (!res.success) throw new Error(res.message || '上架失败');
      toast.success('已上架，别人可以安装了');
      await loadMine();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '上架失败');
    }
  };

  const unpublish = async (appId: string) => {
    if (!token) return;
    try {
      const res = await platformAppsApi.unpublish(token, appId);
      if (!res.success) throw new Error(res.message || '下架失败');
      toast.success('已下架为草稿');
      await loadMine();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '下架失败');
    }
  };

  return (
    <AppPageShell shellClassName={styles.pageRoot} mainClassName={styles.main}>
      <h1 className={styles.title}>手机应用</h1>
      <p className={styles.hint}>
        创作游戏 → 手机应用。对话生成应用草稿（页面与积木描述），由现有手机运行器解释运行；保存后走完整性检查、私有测试、审核上架。游戏世界只能从已上架列表安装（作品只存应用编号）。创作者交出的是应用草稿，应用运行在平台 SDK 上。作者库兰号：{userCode || '（需登录）'}。
      </p>

      <section className={styles.card} data-phone-app-ai="1">
        <h2 className={styles.cardTitle}>AI 对话生成</h2>
        <div className={styles.field}>
          <label htmlFor="app-brief">需求摘要（可选）</label>
          <textarea
            id="app-brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="一两句话描述应用用途、风格、要展示的内容"
          />
        </div>
        <div className={styles.chatLog} role="log" aria-live="polite">
          {turns.map((t, i) => (
            <div
              key={`${t.role}-${i}`}
              className={t.role === 'user' ? styles.chatUser : styles.chatBot}
            >
              {t.text}
            </div>
          ))}
          {chatBusy ? <div className={styles.chatBot}>生成中…</div> : null}
          <div ref={endRef} />
        </div>
        <div className={styles.chatRow}>
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="继续描述或说「按闲鱼风格补内容」"
            disabled={chatBusy}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendChat(chatInput);
              }
            }}
          />
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={chatBusy || !chatInput.trim()}
            onClick={() => void sendChat(chatInput)}
          >
            发送
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{editingId ? `编辑 · ${editingId}` : '草稿字段（可手改）'}</h2>
        <div className={styles.field}>
          <label htmlFor="app-name">名称</label>
          <input
            id="app-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="应用名称"
            maxLength={80}
          />
        </div>
        <div className={styles.field}>
          <label>图标</label>
          <div className={styles.row}>
            {form.icon ? (
              <img className={styles.iconPreview} src={getImageUrl(form.icon)} alt="" />
            ) : (
              <span className={styles.iconPreview} />
            )}
            <label className={styles.btnGhost}>
              上传图标
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => void onPickIcon(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>
        <div className={styles.field}>
          <label>预览图</label>
          <div className={styles.previewRow}>
            {form.previews.map((p) => (
              <img key={p} className={styles.previewThumb} src={getImageUrl(p)} alt="" />
            ))}
          </div>
          <label className={styles.btnGhost}>
            添加预览图
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void onPickPreview(e.target.files?.[0])}
            />
          </label>
        </div>
        <div className={styles.field}>
          <label htmlFor="app-summary">一行说明</label>
          <input
            id="app-summary"
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            placeholder="列表里显示的一句话"
            maxLength={200}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="app-category">分类</label>
          <input
            id="app-category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="如：社交、生活"
            maxLength={40}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="app-type">类型</label>
          <select
            id="app-type"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PlatformAppType }))}
          >
            {PLATFORM_APP_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="app-content">内容</label>
          <textarea
            id="app-content"
            value={form.contentText}
            onChange={(e) => setForm((f) => ({ ...f, contentText: e.target.value }))}
            placeholder="该类型页面要展示的内容（配置/文案，不是代码）"
          />
        </div>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={saving || uploadBusy}
            onClick={() => void save()}
          >
            {saving || uploadBusy ? '保存 / 上传应用草稿…' : editingId ? '保存并上传应用草稿' : '保存草稿并上传应用草稿'}
          </button>
          {editingId ? (
            <button type="button" className={styles.btnGhost} onClick={resetForm}>
              取消编辑
            </button>
          ) : null}
        </div>
      </section>

      {isStaff ? (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>运营 · 已上架应用</h2>
          <p className={styles.hint}>作者和运营改的是同一条记录；保存后商店与已装手机一起更换。</p>
          {published.map((app) => (
            <div key={`pub-${app.appId}`} className={styles.listItem}>
              {app.icon ? (
                <img className={styles.iconPreview} src={getImageUrl(app.icon)} alt="" />
              ) : (
                <span className={styles.iconPreview} />
              )}
              <div className={styles.meta}>
                <p className={styles.metaName}>{app.name}</p>
                <p className={styles.metaSub}>
                  {app.summary || '暂无说明'} · {app.authorName || app.authorId}
                </p>
              </div>
              <button type="button" className={styles.btnGhost} onClick={() => startEdit(app)}>
                编辑
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>我的应用</h2>
        {loading ? <p className={styles.empty}>加载中…</p> : null}
        {!loading && mine.length === 0 ? (
          <p className={styles.empty}>还没有应用，先对话生成或保存一份草稿</p>
        ) : null}
        {mine.map((app) => (
          <div key={app.appId} className={styles.listItem}>
            {app.icon ? (
              <img className={styles.iconPreview} src={getImageUrl(app.icon)} alt="" />
            ) : (
              <span className={styles.iconPreview} />
            )}
            <div className={styles.meta}>
              <p className={styles.metaName}>{app.name}</p>
              <p className={styles.metaSub}>
                {app.summary || '暂无说明'} · {app.authorId}
              </p>
            </div>
            <span className={app.status === 'published' ? styles.badgeOn : styles.badge}>
              {app.status === 'published' ? '已上架' : '草稿'}
            </span>
            <button type="button" className={styles.btnGhost} onClick={() => startEdit(app)}>
              编辑
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              disabled={uploadBusy}
              onClick={() => void uploadPhoneAppDraft(app)}
            >
              上传应用草稿
            </button>
            {app.status === 'published' ? (
              <button type="button" className={styles.btnGhost} onClick={() => void unpublish(app.appId)}>
                下架
              </button>
            ) : (
              <button type="button" className={styles.btnBlue} onClick={() => void publish(app.appId)}>
                上架
              </button>
            )}
          </div>
        ))}
      </section>
    </AppPageShell>
  );
};

export default CreatePlatformApp;
