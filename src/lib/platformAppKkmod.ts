/**
 * 功能注释：手机应用草稿打成 phone_app .kkmod（与 Romance SDK 契约一致），供上传组件商店。
 */

export type PhoneAppKkmodInput = {
  appId: string;
  name: string;
  summary?: string;
  icon?: string;
  type?: string;
  category?: string;
  content?: unknown;
  version?: string;
};

const SAFE_SLUG = /^[a-z0-9][a-z0-9_-]{1,48}$/;

function slugify(raw: string, fallbackPrefix: string): string {
  const base = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  if (SAFE_SLUG.test(base)) return base;
  return `${fallbackPrefix}-${Date.now().toString(36)}`.slice(0, 48);
}

/** 功能注释：组装可校验的 .kkmod JSON 对象（manifest + payload）。 */
export function buildPhoneAppKkmodPackage(app: PhoneAppKkmodInput) {
  const slug = slugify(app.appId || app.name, 'app');
  const name = String(app.name || '未命名应用').trim().slice(0, 80) || '未命名应用';
  return {
    manifest: {
      id: slug,
      slug,
      name,
      version: String(app.version || '0.1.0').trim() || '0.1.0',
      kind: 'phone_app' as const,
      description: String(app.summary || '').trim().slice(0, 500),
      dependencies: [] as string[],
      permissions: ['ui.toast', 'phone.openApp', 'save.game.read', 'save.game.write'],
      configSchema: [] as Array<{ key: string; type: string }>,
      saveMigrate: [] as Array<{ from: string; to: string }>,
      testCases: [{ id: 'smoke', name: '冒烟：启用后不崩溃', expect: 'pass' }],
      phoneAppId: app.appId,
      priceKk: 0,
      navEntry: { needed: true, defaultLabel: name },
    },
    payload: {
      platformApp: {
        appId: app.appId,
        name,
        summary: app.summary || '',
        icon: app.icon || '',
        type: app.type || 'browse',
        category: app.category || '',
        content: app.content ?? {},
      },
    },
  };
}
