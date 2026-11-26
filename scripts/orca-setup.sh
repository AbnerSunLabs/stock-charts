#!/bin/bash
# Orca 新 worktree 初始化脚本（repo setup hook 调用）
# 为什么：新 worktree 只含 git 追踪文件，本地必备的 .env*.local（含密钥）与
# pnpm-lock.yaml（被 .gitignore 忽略，git 只追踪 npm 锁）均不在 git 内；
# 缺前者 build/dev 不水合，缺后者 pnpm 会无锁全量解析产生依赖漂移，
# 故统一从主 checkout 拷贝后再独立安装依赖
set -euo pipefail

# .nvmrc 统一解析：原始值与主版本号各只此一处，避免多处规则分叉
nvmrc_raw() { tr -d '[:space:]' < .nvmrc 2>/dev/null || true; }
nvmrc_major() { nvmrc_raw | sed 's/^v//;s/^\([0-9]*\).*/\1/'; }

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

  # ---- 工具链对齐：node 主版本须匹配 .nvmrc 且 pnpm 可用，否则尝试 nvm 切换 ----
  # 闸门不只看 pnpm：pnpm 在 PATH 而 node 错位时同样要切，防按错误 ABI 装依赖
  WANT_V=$(nvmrc_major)
  GOT_V=""
  command -v node >/dev/null 2>&1 && GOT_V=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo "")
  NEED_NVM=false
  { [ -n "$WANT_V" ] && [ "$WANT_V" != "$GOT_V" ]; } && NEED_NVM=true
  command -v pnpm >/dev/null 2>&1 || NEED_NVM=true
  if [ "$NEED_NVM" = true ]; then
    # NVM_DIR 探测含 brew 安装路径：非交互 hook 不加载 profile；
    # 注意 brew 场景 nvm.sh 在 keg，但版本目录按 caveats 仍在 ~/.nvm
    NVM_SH="${NVM_DIR:-}/nvm.sh"
    if [ -z "${NVM_DIR:-}" ]; then
      if [ -s "$HOME/.nvm/nvm.sh" ]; then
        export NVM_DIR="$HOME/.nvm"; NVM_SH="$NVM_DIR/nvm.sh"
      elif [ -s "/opt/homebrew/opt/nvm/nvm.sh" ]; then
        export NVM_DIR="$HOME/.nvm"; NVM_SH="/opt/homebrew/opt/nvm/nvm.sh"
      elif [ -s "/usr/local/opt/nvm/nvm.sh" ]; then
        export NVM_DIR="$HOME/.nvm"; NVM_SH="/usr/local/opt/nvm/nvm.sh"
      fi
    fi
    # shellcheck disable=SC1091
    if [ -s "$NVM_SH" ]; then
      # source 与 nvm use 均在 set +u 保护内：部分 nvm 版本与 set -u 不兼容
      set +u
      . "$NVM_SH"
      if ! nvm use --silent >/dev/null 2>&1; then
        echo "[orca-setup] 警告：nvm use 失败（.nvmrc=$(nvmrc_raw)），请先 nvm install $(nvmrc_raw)" >&2
      fi
      set -u
    else
      echo "[orca-setup] 警告：未找到 nvm（~/.nvm 与 brew 路径均无）" >&2
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

  # ---- 装依赖：frozen 优先；失败透传 pnpm 原始输出，不武断归因（锁不匹配/网络皆有可能）----
  if ! $PNPM install --frozen-lockfile; then
    echo "[orca-setup] 警告：frozen 安装失败（原因见上方 pnpm 输出），回退常规解析" >&2
    $PNPM install
  fi
fi

# ---- node 大版本终检（装完依赖后与自跑共用；非数字 .nvmrc 跳过）----
WANT_V=$(nvmrc_major)
if [ -n "$WANT_V" ] && command -v node >/dev/null 2>&1; then
  GOT_V=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo "")
  [ "$WANT_V" = "$GOT_V" ] || echo "[orca-setup] 警告：node v$GOT_V 与 .nvmrc（$WANT_V）不一致，原生依赖可能按错误 ABI 安装" >&2
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
