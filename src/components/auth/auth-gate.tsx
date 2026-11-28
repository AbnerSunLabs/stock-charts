'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
  type ReactNode,
} from 'react';
import { Spin, Result, Button, App } from 'antd';
import type { User } from '@supabase/supabase-js';
import { checkFamilyAccess, signOut } from '@/lib/supabase/auth';
import { LoginModal } from './login-modal';
import { UserMenu } from './user-menu';

export interface AuthGateProps {
  children: ReactNode;
  /** 未登录时 OAuth 回跳路径 */
  redirectPath: string;
}

type GateStatus = 'loading' | 'need_login' | 'denied' | 'allowed';

type GateState =
  | { status: 'loading' }
  | { status: 'need_login' }
  | { status: 'denied' }
  | { status: 'allowed'; user: User };

/** 门禁访问判定结果（refresh 内部流转使用） */
type AccessOutcome =
  | { kind: 'need_login' }
  | { kind: 'denied' }
  | { kind: 'allowed'; user: User };

/** 拉取并判定门禁结果；无权限时顺带登出，提示由调用方统一弹出 */
async function resolveAccessOutcome(onWarn: (text: string) => void): Promise<AccessOutcome> {
  const result = await checkFamilyAccess();
  if (!result.session) return { kind: 'need_login' };
  if (!result.allowed) {
    onWarn('当前 GitHub 账号无家庭财务访问权限');
    await signOut();
    return { kind: 'denied' };
  }
  return { kind: 'allowed', user: result.user! };
}

/**
 * 状态变化：loading 核验占位。antd5 独立 Spin 不渲染 tip，必须嵌套子容器；
 * 外壳保持 min-h 等高占位，核验放行后内容淡入覆盖，避免整页替换塌缩。
 */
function LoadingGateView() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center py-16">
      <Spin size="large" tip="正在核验登录状态…">
        <div className="h-24 w-72" aria-hidden />
      </Spin>
    </div>
  );
}

/** denied / need_login 视图：Result 提示 + 登录弹窗（与其它状态的切换由外层交叉淡切承担） */
function GateResultView({
  denied,
  loginOpen,
  onLoginOpenChange,
  redirectPath,
}: {
  denied: boolean;
  loginOpen: boolean;
  onLoginOpenChange: (open: boolean) => void;
  redirectPath: string;
}) {
  return (
    <>
      <Result
        status={denied ? '403' : 'info'}
        title={denied ? '无访问权限' : '需要登录'}
        subTitle={denied ? '请使用已加入白名单的 GitHub 账号登录。' : '家庭财务仅对授权账号开放。'}
        extra={
          <Button type="primary" onClick={() => onLoginOpenChange(true)}>
            {denied ? '重新登录' : '使用 GitHub 登录'}
          </Button>
        }
      />
      <LoginModal
        open={loginOpen}
        onClose={() => onLoginOpenChange(false)}
        redirectTo={redirectPath}
      />
    </>
  );
}

/** allowed 视图：门禁放行后的正文（入场由外层交叉淡切的淡入上移承担） */
function AllowedGateView({
  user,
  onSignedOut,
  children,
}: {
  user: User;
  onSignedOut: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex justify-end mb-3">
        <UserMenu user={user} onSignedOut={onSignedOut} />
      </div>
      {children}
    </div>
  );
}

/** 交叉淡切层：id 唯一标识（同一状态可能短时间内反复出现，不能拿状态名当 key） */
interface GateLayer {
  id: number;
  key: GateStatus;
  node: ReactNode;
  leaving: boolean;
}

/** 退场兜底卸载时限：exit-small(140ms) + 充分余量，覆盖 animationend 缺席的最坏情况 */
const GATE_EXIT_FALLBACK_MS = 320;

/**
 * 状态变化：门禁各状态视图（loading/need_login/denied/allowed）切换时交叉淡切——
 * 新层 small 档（180ms）淡入上移，旧层走独立的 viewFadeOut（exit-small 档）淡出下移，
 * 退场短于进场；不同名 keyframe 保证切换时动画必然重新开始。
 * 双层叠放在同一 grid 单元互不推挤；时长曲线全走 token，reduced-motion 下
 * 全局兜底把动画压至 0.01ms，animationend 立即触发并卸载，直接到终态。
 */
function GateCrossFade({ layerKey, children }: { layerKey: GateStatus; children: ReactNode }) {
  const nextId = useRef(1);
  const [layers, setLayers] = useState<GateLayer[]>(() => [
    { id: 0, key: layerKey, node: children, leaving: false },
  ]);

  useEffect(() => {
    setLayers(prev => {
      const active = prev.find(layer => !layer.leaving);
      if (active?.key === layerKey) {
        // 同状态内容刷新（如 need_login 下开关登录弹窗、user 对象更新）：
        // 原地替换节点，不重播入场动画
        return active.node === children
          ? prev
          : prev.map(layer => (layer === active ? { ...layer, node: children } : layer));
      }
      // 状态切换：旧层全部转入退场（淡出后由 onAnimationEnd 卸载），新层淡入
      return [
        ...prev.map(layer => ({ ...layer, leaving: true })),
        { id: nextId.current++, key: layerKey, node: children, leaving: false },
      ];
    });
  }, [layerKey, children]);

  const dropLayer = useCallback((id: number) => {
    setLayers(prev => prev.filter(layer => layer.id !== id));
  }, []);

  // 兜底卸载：animationend 在动画被取消 / 祖先隐藏等场景可能缺席，
  // 退场层超时后强制移除，杜绝「透明但仍在 DOM、可被 Tab 聚焦」的幽灵层。
  // 定时器故意不随 layers 变化清理（dropLayer 按 id 过滤，幂等且安全）。
  const pendingDropsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    for (const layer of layers) {
      if (!layer.leaving || pendingDropsRef.current.has(layer.id)) continue;
      pendingDropsRef.current.add(layer.id);
      window.setTimeout(
        () => {
          pendingDropsRef.current.delete(layer.id);
          dropLayer(layer.id);
        },
        GATE_EXIT_FALLBACK_MS
      );
    }
  }, [layers, dropLayer]);

  return (
    <div className="grid">
      {layers.map(layer => (
        <div
          key={layer.id}
          aria-hidden={layer.leaving || undefined}
          className={`[grid-area:1/1] ${
            layer.leaving
              ? 'pointer-events-none animate-[viewFadeOut_var(--motion-duration-exit-small)_var(--motion-ease-in)_both]'
              : 'animate-[viewFadeIn_var(--motion-duration-small)_var(--motion-ease-out)_both]'
          }`}
          onAnimationEnd={
            layer.leaving
              ? (event: AnimationEvent<HTMLDivElement>) => {
                  if (event.target === event.currentTarget) dropLayer(layer.id);
                }
              : undefined
          }
        >
          {layer.node}
        </div>
      ))}
    </div>
  );
}

/**
 * 家庭财务门禁：需有效 session + 白名单。
 * 状态机各视图之间的切换（loading→allowed、need_login↔denied 等）由 GateCrossFade 交叉淡切承接。
 */
export function AuthGate({ children, redirectPath }: AuthGateProps) {
  const { message } = App.useApp();
  const [state, setState] = useState<GateState>({ status: 'loading' });
  const [loginOpen, setLoginOpen] = useState(false);

  const refresh = useCallback(async () => {
    // 状态变化：复核先回到 loading 等高占位，结果态再交叉淡切进入
    setState({ status: 'loading' });
    try {
      const outcome = await resolveAccessOutcome(text => message.warning(text));
      setLoginOpen(outcome.kind === 'need_login');
      setState(
        outcome.kind === 'allowed'
          ? { status: 'allowed', user: outcome.user }
          : { status: outcome.kind }
      );
    } catch (e) {
      // 文案规范：兜底错误不露黑话，给下一步动作
      message.error(e instanceof Error ? e.message : '登录状态核验失败，请重试');
      setState({ status: 'need_login' });
      setLoginOpen(true);
    }
  }, [message]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <GateCrossFade layerKey={state.status}>
      {state.status === 'loading' ? (
        <LoadingGateView />
      ) : state.status === 'allowed' ? (
        <AllowedGateView user={state.user} onSignedOut={() => void refresh()}>
          {children}
        </AllowedGateView>
      ) : (
        <GateResultView
          denied={state.status === 'denied'}
          loginOpen={loginOpen}
          onLoginOpenChange={setLoginOpen}
          redirectPath={redirectPath}
        />
      )}
    </GateCrossFade>
  );
}
