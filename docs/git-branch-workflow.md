# Git 分支管理流程

## 背景

在 `feature/i18n` 分支上进行国际化开发，持续同步 `cloudflare` 分支的更新，最后合并到 `main` 分支。

---

## 步骤一：初始化（一次性操作）

在首次设置或长时间未同步时执行：

```bash
# 1. 切换到 cloudflare
git checkout cloudflare

# 2. 拉取最新代码（解决落后 7 个 commit 的问题）
git pull

# 3. 切换回 feature/i18n
git checkout feature/i18n

# 4. 把最新 cloudflare 合并进来（feature/i18n 现在基于最新代码）
git merge cloudflare

# 5. 恢复之前 stash 的改动
git stash pop
```

### 执行效果

```
更新前：feature/i18n 基于旧 cloudflare (落后 7 commit)
更新后：feature/i18n 基于最新 cloudflare + 保留 i18n 改动
```

### 图示

```
origin/cloudflare ── 最新代码
       ↓
       │ (git checkout + git pull)
       ↓
本地 cloudflare ── 与远程同步
       ↓
       │ (git checkout feature/i18n)
       ↓
本地 feature/i18n ── 基于旧 cloudflare
       ↓
       │ (git merge cloudflare)
       ↓
本地 feature/i18n ── 基于最新 cloudflare
       ↓
       │ (git stash pop)
       ↓
本地 feature/i18n ── 最新 cloudflare + i18n 改动
```

---

## 步骤二：日常开发循环

每次开始开发前执行，保持 `feature/i18n` 与最新代码同步：

```bash
# 1. 确保在 feature/i18n
git checkout feature/i18n

# 2. 拉取 cloudflare 最新更新并合并到当前分支
git fetch origin cloudflare
git merge origin/cloudflare
```

### 说明

- `git fetch` 只下载远程更新，不自动合并
- `git merge` 将下载的内容合并到当前分支
- 如果有冲突，需要手动解决后 `git add` 和 `git commit`

### 图示

```
origin/cloudflare ── 新 commit ── 新 commit
       ↓ (git fetch)
本地 origin/cloudflare ── 同步
       ↓ (git merge)
feature/i18n ── 包含最新代码
```

---

## 步骤三：开发完成后合并到 main

当 `feature/i18n` 开发完成，准备合并到主分支时执行：

```bash
# 1. 先确保 feature/i18n 是最新的（同步 cloudflare）
git checkout feature/i18n
git fetch origin cloudflare
git merge origin/cloudflare

# 2. 切换到 main
git checkout main

# 3. 拉取 main 最新
git pull

# 4. 合并 feature/i18n
git merge feature/i18n

# 5. 推送到远程
git push origin main
```

### 图示

```
feature/i18n ── 开发完成
       ↓ (git merge origin/cloudflare)
feature/i18n ── 最新 cloudflare + 完整功能
       ↓ (git checkout main + git pull)
main ── 最新代码
       ↓ (git merge feature/i18n)
main ── 包含 i18n 功能
       ↓ (git push)
origin/main ── 推送到远程
```

---

## Stash 相关操作

### 保存当前改动
```bash
git stash
```

### 查看 stash 列表
```bash
git stash list
```

### 恢复最新 stash
```bash
git stash pop
```

### 恢复指定 stash
```bash
git stash pop stash@{0}
```

---

## 注意事项

1. **冲突处理**：合并时如果出现冲突，Git 会提示哪些文件有冲突，编辑解决后执行：
   ```bash
   git add <解决冲突后的文件>
   git commit
   ```

2. **推送新分支**：如果 `feature/i18n` 尚未推送到远程：
   ```bash
   git push -u origin feature/i18n
   ```
   之后就可以用 `git push` 直接推送。

3. **查看状态**：任何时候都可以用以下命令查看状态：
   ```bash
   git status          # 查看当前状态
   git branch -vv      # 查看分支追踪关系
   git log --oneline   # 查看提交历史
   ```

4. **分支落后检查**：
   ```bash
   git branch -vv
   ```
   如果显示 `[origin/xxx: behind N]`，表示本地分支落后远程 N 个 commit，需要合并。
