#!/bin/bash
# Orca 新 worktree 初始化脚本（repo setup hook 调用）
# 为什么：新 worktree 只含 git 追踪文件，而本地必备的 .env.local（含密钥）与
# pnpm-lock.yaml（被 .gitignore 忽略，git 只追踪 npm 锁）均不在 git 内；
# 缺前者 build/dev 不水合，缺后者 pnpm 会无锁全量解析并改写共享的 node_modules，
# 故统一从主 checkout 拷贝后再装依赖
set -euo pipefail

# ---- 定位主 checkout：git worktree 列表首个条目；sed 取整段路径，兼容含空格目录 ----
MAIN=$(git worktree list --porcelain | sed -n 's/^worktree //p' | head -1)
MAIN_REAL=$(cd "$MAIN" 2>/dev/null && pwd -P) || MAIN_REAL=""
CUR_REAL=$(pwd -P)
IN_WORKTREE=false
if [ -n "$MAIN_REAL" ] && [ "$MAIN_REAL" != "$CUR_REAL" ]; then
  IN_WORKTREE=true
fi

# ---- 补全 PATH：非交互 shell 不加载 nvm，source 官方 nvm.sh 以原生支持 .nvmrc ----
# （含裸版本号、v 前缀、alias 等全部写法，避免手搓解析与 nvm 语义漂移）
if ! command -v pnpm >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
    nvm use --silent >/dev/null 2>&1 || true
  fi
fi
if command -v pnpm >/dev/null 2>&1; then
  PNPM="pnpm"
else
  # 兜底：corepack 默认版本可能偏离项目环境，仅作 nvm 缺失时的最后手段
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  PNPM="corepack pnpm"
  echo "[orca-setup] 警告：未找到 nvm/pnpm，使用 corepack 默认版本安装" >&2
fi

# ---- 从主 checkout 拷贝本地文件（已存在则跳过，保留 worktree 内的定制）----
if [ "$IN_WORKTREE" = true ]; then
  for f in .env.local pnpm-lock.yaml; do
    if [ ! -f "./$f" ]; then
      if [ -f "$MAIN/$f" ]; then
        cp "$MAIN/$f" "./$f"
        echo "[orca-setup] $f 已从主 checkout 拷贝"
      fi
    else
      echo "[orca-setup] $f 已存在，跳过（保留当前 worktree 定制）"
    fi
  done
fi

# ---- 装依赖（node_modules 由 orca.yaml 软链共享；锁已拷入，按锁解析不漂移）----
$PNPM install
