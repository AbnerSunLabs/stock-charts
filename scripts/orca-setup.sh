#!/bin/bash
# Orca 新 worktree 初始化脚本（repo setup hook 调用）
# 为什么：新 worktree 只含 git 追踪文件，本地必备的 .env*.local（含密钥）与
# pnpm-lock.yaml（被 .gitignore 忽略，git 只追踪 npm 锁）均不在 git 内；
# 缺前者 build/dev 不水合，缺后者 pnpm 会无锁全量解析产生依赖漂移，
# 故统一从主 checkout 拷贝后再独立安装依赖
set -euo pipefail

# ---- 统一工作目录到仓库根（允许从子目录手动触发），并定位主 checkout ----
cd "$(git rev-parse --show-toplevel)"
MAIN=""
if [ "$(git rev-parse --git-dir)" != "$(git rev-parse --git-common-dir)" ]; then
  # 在 worktree 内：common dir 即主仓库 .git，其父目录即主 checkout
  # 显式拦截旧版 git（--path-format=absolute 需 ≥2.31），避免 MAIN 静默退化
  COMMON_DIR=$(git rev-parse --path-format=absolute --git-common-dir) || {
    echo "[orca-setup] 错误：git 版本过旧（需 ≥2.31），无法定位主 checkout" >&2
    exit 1
  }
  MAIN=$(cd "$COMMON_DIR/.." && pwd -P)
fi

# ---- 补全 PATH：非交互 shell 不加载 nvm，source 官方 nvm.sh 以原生支持 .nvmrc ----
# （含裸版本号、v 前缀、alias 等全部写法，避免手搓解析与 nvm 语义漂移）
if ! command -v pnpm >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
    # 失败不静默：提示缺哪个版本，避免后续 command not found 无从定位
    if ! nvm use --silent >/dev/null 2>&1; then
      WANT=$(tr -d '[:space:]' < .nvmrc 2>/dev/null || echo '?')
      echo "[orca-setup] 警告：nvm use 失败（.nvmrc=$WANT），请先 nvm install $WANT" >&2
    fi
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
# pnpm 已在 PATH（跳过 nvm）时校验 node 大版本与 .nvmrc 一致，工具链错位仅告警
if command -v node >/dev/null 2>&1 && [ -f .nvmrc ]; then
  WANT_V=$(tr -d '[:space:]' < .nvmrc | sed 's/^v//;s/^\([0-9]*\).*/\1/')
  GOT_V=$(node -p 'process.versions.node.split(".")[0]')
  [ "$WANT_V" = "$GOT_V" ] || echo "[orca-setup] 警告：node v$GOT_V 与 .nvmrc（$WANT_V）不一致" >&2
fi

if [ -n "$MAIN" ]; then
  # ---- 从主 checkout 拷贝本地文件（已存在则跳过，保留 worktree 内的定制）----
  # 对齐 .gitignore 的 .env*.local 通配语义，覆盖所有本地 env 变体
  for f in "$MAIN"/.env*.local "$MAIN"/pnpm-lock.yaml; do
    [ -e "$f" ] || continue # glob 无匹配时跳过（缺失告警在拷贝后统一处理）
    name=$(basename "$f")
    if [ ! -e "./$name" ]; then
      cp "$f" "./$name"
      echo "[orca-setup] $name 已从主 checkout 拷贝"
    else
      echo "[orca-setup] $name 已存在，跳过（保留当前 worktree 定制）"
    fi
  done
  # 清理旧共享方案遗留的 node_modules 软链：pnpm 透过软链会改写主 checkout 依赖
  if [ -L ./node_modules ]; then
    rm ./node_modules
    echo "[orca-setup] 已移除遗留的 node_modules 软链（旧共享方案）"
  fi
  # ---- 装依赖（pnpm 全局 store 硬链复用，独立安装秒级且互不污染）----
  $PNPM install
fi

# ---- 体检（worktree 拷贝后与主 checkout 自跑共用；以本目录实际状态为准）----
# 关键文件缺失显式告警：静默跳过会把失败推迟到 build 阶段且无从定位
if ! compgen -G "./.env*.local" >/dev/null; then
  echo "[orca-setup] 警告：无任何 .env*.local，build/dev 将不水合（主 checkout 请先配置）" >&2
fi
if [ ! -f ./pnpm-lock.yaml ]; then
  echo "[orca-setup] 警告：缺 pnpm-lock.yaml，依赖将无锁解析" >&2
fi
[ -n "$MAIN" ] || echo "[orca-setup] 主 checkout 自跑，跳过依赖安装（由日常流程管理）"
