---
name: sync-feature-branch
description: 同步 feature 分支与 cloudflare base 分支的工作流。当用户提到同步分支、合并 cloudflare、保持分支最新、合并到 main，或遇到 merge conflict 时使用。
---

# 同步 Feature 分支工作流

## 同步 cloudflare 到当前 feature 分支

每次开始开发前执行：

```bash
git checkout feature/xxx
git fetch origin cloudflare
git merge origin/cloudflare
```

有冲突时：解决后 `git add <file>` + `git commit`。

## 合并 feature 分支到 main

开发完成后执行：

```bash
# 1. 确保 feature 分支最新
git checkout feature/xxx
git fetch origin cloudflare
git merge origin/cloudflare

# 2. 切到 main 并拉最新
git checkout main
git pull

# 3. 合并并推送
git merge feature/xxx
git push origin main
```

## Stash 操作

```bash
git stash            # 保存当前改动
git stash list       # 查看 stash 列表
git stash pop        # 恢复最新 stash
git stash pop stash@{0}   # 恢复指定 stash
```

## 状态检查

```bash
git status           # 当前状态
git branch -vv       # 查看分支追踪关系，[behind N] 表示落后远程 N 个 commit
git log --oneline    # 提交历史
```

## 注意事项

- 出现冲突时，编辑解决后 `git add <file>` 再 `git commit`
- feature 分支未推送过：用 `git push -u origin feature/xxx`
- 之后直接 `git push` 即可
