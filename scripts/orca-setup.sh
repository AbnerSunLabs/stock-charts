#!/bin/bash
# Orca 新 worktree 初始化脚本（repo setup hook 调用）
# 为什么：新 worktree 只含 git 追踪文件，.env.local 被 gitignore 不会带过来，
# 缺 Supabase 环境变量时 build/dev 不水合；故从主 checkout 拷贝后再装依赖
set -euo pipefail

# ---- 补全 PATH：非交互 shell 不加载 nvm，按 .nvmrc 探测 pnpm 实际位置 ----
PNPM_BIN=""
if ! command -v pnpm >/dev/null 2>&1; then
  NVM_DIR_NODES="$HOME/.nvm/versions/node"
  # 优先 .nvmrc 指定版本（与交互 shell 行为一致），否则取最新
  WANT=$(cat .nvmrc 2>/dev/null | tr -d '[:space:]' || true)
  if [ -n "$WANT" ] && [ -d "$NVM_DIR_NODES/$WANT/bin" ]; then
    PNPM_BIN="$NVM_DIR_NODES/$WANT/bin"
  elif [ -d "$NVM_DIR_NODES" ]; then
    LATEST=$(ls -v "$NVM_DIR_NODES" | tail -1)
    PNPM_BIN="$NVM_DIR_NODES/$LATEST/bin"
  fi
  [ -n "$PNPM_BIN" ] && export PATH="$PNPM_BIN:$PATH"
fi
# 最终兜底：corepack（node 自带）
if command -v pnpm >/dev/null 2>&1; then
  PNPM="pnpm"
else
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  PNPM="corepack pnpm"
fi

# ---- 主 checkout = git worktree 列表的第一个条目 ----
MAIN=$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')
MAIN_REAL=$(cd "$MAIN" 2>/dev/null && pwd -P) || MAIN_REAL=""
CUR_REAL=$(pwd -P)

# 拷贝本地环境变量（主 checkout 自身跳过，避免同文件拷贝报错）
if [ -n "$MAIN_REAL" ] && [ "$MAIN_REAL" != "$CUR_REAL" ] && [ -f "$MAIN/.env.local" ]; then
  cp "$MAIN/.env.local" ./.env.local
  echo "[orca-setup] .env.local 已从主 checkout 拷贝"
fi

# 装依赖（node_modules 已由 orca.yaml 软链共享，此处通常秒级幂等）
$PNPM install
