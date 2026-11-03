import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  creatorWorkStatusLabel,
  isDraftSlotWork,
  resolveCreatorWorkStatus,
} from "../src/utils/creatorWorkLifecycle.ts";

test("作品生命周期_草稿名额只统计未提交作品", () => {
  assert.equal(isDraftSlotWork({ is_public: 0, moderation_status: "none" }), true);
  assert.equal(isDraftSlotWork({ is_public: 0, moderation_status: "pending_review" }), false);
  assert.equal(isDraftSlotWork({ is_public: 0, moderation_status: "rejected" }), false);
  assert.equal(isDraftSlotWork({ is_public: 1, moderation_status: "none" }), false);
});

test("作品生命周期_新作与更新审核标签准确", () => {
  assert.equal(resolveCreatorWorkStatus({ is_public: 0, moderation_status: "pending_review" }), "pending");
  assert.equal(resolveCreatorWorkStatus({ is_public: 1, moderation_status: "update_pending_review" }), "update_pending");
  assert.equal(creatorWorkStatusLabel("pending"), "审核中");
  assert.equal(creatorWorkStatusLabel("update_pending"), "更新审核中");
  assert.equal(creatorWorkStatusLabel("rejected"), "未通过");
});

test("作品入口_书架承载作品分类且我的不再重复显示", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const profile = readFileSync(new URL("../src/page/Create.tsx", import.meta.url), "utf8");
  const shelf = readFileSync(new URL("../src/page/CreateWorks.tsx", import.meta.url), "utf8");
  assert.match(app, /path="\/bookshelf" element=\{<CreateWorks \/>}/);
  assert.doesNotMatch(profile, /<CreatorWorksPanel/);
  assert.match(shelf, /initialTab=\{initialTab}/);
});

test("更新提交_先询问日志且填写时不能为空", () => {
  const modal = readFileSync(
    new URL("../src/components/CommonModal/PublishSettingsModal.tsx", import.meta.url),
    "utf8",
  );
  assert.match(modal, /要填写更新日志吗？/);
  assert.match(modal, /更新日志不能为空/);
  assert.match(modal, /updateLogChoice === 'without'/);
  assert.match(modal, /updateLogChoice === 'with' \? versionNotes\.trim\(\) : null/);
});
