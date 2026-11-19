/**
 * 运行配置：生文多网关书签（Tab）与「当前使用」提示。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeTextLlmOpenAiBaseUrl } from '../src/lib/textLlmConfig.ts';
import {
  buildGatewayTabs,
  formatActiveGatewayUsageHint,
  labelForCustomGateway,
  makeCustomGatewayTabId,
  resolveGatewayLabelForBaseUrl,
  resolveGatewayTabId,
} from '../src/lib/modelConfigGatewayTabs.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const presets = [
  { id: 'epone', label: 'GGB（默认）', baseUrl: 'https://epone.ggb.today' },
  { id: 'tokenhub', label: 'TokenHub', baseUrl: 'https://tokenhub.tencentmaas.com' },
];

test('buildGatewayTabs_预置加当前自定义地址', () => {
  const tabs = buildGatewayTabs({
    presets,
    activeBaseUrl: 'https://tokenhub.tencentaigc.com/',
    normalizeBaseUrl: normalizeTextLlmOpenAiBaseUrl,
  });
  assert.equal(tabs.length, 3);
  assert.equal(tabs[0].id, 'epone');
  assert.equal(tabs[1].id, 'tokenhub');
  assert.equal(tabs[2].isCustom, true);
  assert.match(tabs[2].label, /tokenhub\.tencentaigc\.com/);
  assert.equal(
    resolveGatewayTabId('https://tokenhub.tencentaigc.com', tabs, normalizeTextLlmOpenAiBaseUrl),
    tabs[2].id,
  );
});

test('buildGatewayTabs_生效地址命中预置时不追加自定义', () => {
  const tabs = buildGatewayTabs({
    presets,
    activeBaseUrl: 'https://epone.ggb.today/v1',
    normalizeBaseUrl: normalizeTextLlmOpenAiBaseUrl,
  });
  assert.equal(tabs.length, 2);
  assert.equal(resolveGatewayTabId('https://epone.ggb.today', tabs, normalizeTextLlmOpenAiBaseUrl), 'epone');
});

test('makeCustomGatewayTabId_空草稿用 seed 稳定', () => {
  const a = makeCustomGatewayTabId('', normalizeTextLlmOpenAiBaseUrl, 'seed-1');
  const b = makeCustomGatewayTabId('', normalizeTextLlmOpenAiBaseUrl, 'seed-1');
  assert.equal(a, b);
  assert.equal(labelForCustomGateway(''), '自定义网关');
});

test('formatActiveGatewayUsageHint_厂家与模型', () => {
  const withModel = formatActiveGatewayUsageHint({
    gatewayLabel: 'TokenHub',
    modelName: 'DeepSeek V4.1 Flash',
  });
  assert.equal(withModel.gatewayLabel, 'TokenHub');
  assert.equal(withModel.modelName, 'DeepSeek V4.1 Flash');
  assert.equal(
    resolveGatewayLabelForBaseUrl(
      'https://tokenhub.tencentmaas.com',
      buildGatewayTabs({ presets, activeBaseUrl: '', normalizeBaseUrl: normalizeTextLlmOpenAiBaseUrl }),
      normalizeTextLlmOpenAiBaseUrl,
    ),
    'TokenHub',
  );
});

test('ModelConfigHub_生文书签栏与新增提示接线', () => {
  const hub = readFileSync(join(root, 'src/components/ModelConfigHub.tsx'), 'utf8');
  const css = readFileSync(join(root, 'src/components/ModelConfigHub.module.css'), 'utf8');
  const zh = readFileSync(join(root, 'src/i18n/locales/zh.json'), 'utf8');

  assert.match(hub, /buildGatewayTabs/);
  assert.match(hub, /handleAddTextGatewayTab/);
  assert.match(hub, /aiModelCenter\.configHub\.addGateway/);
  assert.match(hub, /aiModelCenter\.configHub\.activeUsage/);
  assert.match(hub, /gatewayTabBar/);
  assert.match(hub, /ConfirmModal/);
  assert.doesNotMatch(hub, /window\.confirm/);
  assert.doesNotMatch(hub, /selectPresetTextModel|role="radiogroup"/);

  assert.match(css, /\.gatewayTabBar/);
  assert.match(css, /\.gatewayTabActive/);
  assert.match(css, /\.gatewayActiveHint/);

  assert.match(zh, /"addGateway":\s*"新增"/);
  assert.match(zh, /"activeUsage":\s*"当前使用：\{\{gateway\}\}"/);
  assert.match(zh, /"activeUsageWithModel":\s*"当前使用：\{\{gateway\}\} · \{\{model\}\}"/);
  assert.match(zh, /"inUseBadge":\s*"使用中"/);
});
