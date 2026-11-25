/**
 * 面向用户的错误文案：底层异常含中文（多为业务校验）时直接使用，
 * 纯英文的技术报错（网络/数据库术语）替换为可行动的中文兜底——
 * 用户需要知道"该不该重试"，而不是读堆栈。
 */
export function describeError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  const hasCjk = /[一-鿿]/.test(message);
  return hasCjk && message.trim() ? message : fallback;
}
