import type { SupabaseClient } from '@supabase/supabase-js';
import { runGridCalculation } from '@/lib/grid-run-calculation';
import { GridStrategyRepository } from '@/lib/supabase/grid-strategy-repository';
import { validateGridParams } from '@/lib/grid-validate-params';
import { DEFAULT_GRID_PARAMS } from '@/types/grid';

type QueryResult = { data: unknown; error: { code?: string; message: string } | null };

function createQueryBuilder(result: QueryResult) {
  const builder: Record<string, jest.Mock> = {};
  const methods = [
    'select',
    'eq',
    'order',
    'insert',
    'update',
    'delete',
    'single',
    'maybeSingle',
  ] as const;

  for (const method of methods) {
    builder[method] = jest.fn(() => builder);
  }

  // thenable：await 链式调用时落到结果
  (builder as { then: typeof Promise.prototype.then }).then = (
    onfulfilled,
    onrejected
  ) => Promise.resolve(result).then(onfulfilled, onrejected);

  return builder;
}

function createClient(options?: {
  userId?: string | null;
  authError?: Error | null;
  result?: QueryResult;
}) {
  const userId = options?.userId === undefined ? 'user-1' : options.userId;
  const result = options?.result ?? { data: null, error: null };
  const builder = createQueryBuilder(result);
  const from = jest.fn(() => builder);
  const client = {
    auth: {
      getUser: jest.fn().mockResolvedValue(
        options?.authError
          ? { data: { user: null }, error: options.authError }
          : {
              data: { user: userId ? { id: userId } : null },
              error: null,
            }
      ),
    },
    from,
  } as unknown as SupabaseClient;

  return { client, from, builder };
}

function buildPayload() {
  const validation = validateGridParams(DEFAULT_GRID_PARAMS);
  const resultSnapshot = runGridCalculation(
    DEFAULT_GRID_PARAMS,
    { dynamicGridEnabled: false, dynamicGridMode: 'stable' },
    validation
  );
  return {
    config: {
      params: DEFAULT_GRID_PARAMS,
      dynamicGridEnabled: false,
      dynamicGridMode: 'stable' as const,
    },
    resultSnapshot,
  };
}

function savedRow(overrides: Record<string, unknown> = {}) {
  const payload = buildPayload();
  return {
    id: 'strategy-1',
    user_id: 'user-1',
    name: '策略一',
    schema_version: 1,
    config: payload.config,
    result_snapshot: payload.resultSnapshot,
    created_at: '2026-08-07T01:00:00.000Z',
    updated_at: '2026-08-07T02:00:00.000Z',
    ...overrides,
  };
}

describe('GridStrategyRepository', () => {
  it('列表仅查询元数据并按更新时间倒序', async () => {
    const { client, builder } = createClient({
      result: {
        data: [
          {
            id: 'strategy-1',
            name: 'A',
            schema_version: 1,
            created_at: '2026-08-07T01:00:00.000Z',
            updated_at: '2026-08-07T03:00:00.000Z',
          },
        ],
        error: null,
      },
    });
    const repo = new GridStrategyRepository(client);
    const list = await repo.list();

    expect(builder.select).toHaveBeenCalledWith(
      'id,name,symbol,schema_version,created_at,updated_at'
    );
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(list[0]?.name).toBe('A');
  });

  it('get 同时过滤 user_id 与 id', async () => {
    const { client, builder } = createClient({
      result: { data: savedRow(), error: null },
    });
    const repo = new GridStrategyRepository(client);
    const saved = await repo.get('strategy-1');

    expect(builder.select).toHaveBeenCalledWith('*');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.eq).toHaveBeenCalledWith('id', 'strategy-1');
    expect(saved.id).toBe('strategy-1');
  });

  it('create 写入规范化名称与版本', async () => {
    const payload = buildPayload();
    const { client, builder } = createClient({
      result: { data: savedRow({ name: '策略一' }), error: null },
    });
    const repo = new GridStrategyRepository(client);
    await repo.create('  策略一  ', payload);

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        name: '策略一',
        schema_version: 1,
        config: payload.config,
        result_snapshot: payload.resultSnapshot,
      })
    );
  });

  it('update 不写 name/user_id', async () => {
    const payload = buildPayload();
    const { client, builder } = createClient({
      result: { data: savedRow(), error: null },
    });
    const repo = new GridStrategyRepository(client);
    await repo.update('strategy-1', payload);

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        config: payload.config,
        result_snapshot: payload.resultSnapshot,
        updated_at: expect.any(String),
      })
    );
    const updateArg = builder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg).not.toHaveProperty('name');
    expect(updateArg).not.toHaveProperty('user_id');
  });

  it('rename 只写名称与 updated_at', async () => {
    const { client, builder } = createClient({
      result: {
        data: {
          id: 'strategy-1',
          name: '新名',
          schema_version: 1,
          created_at: '2026-08-07T01:00:00.000Z',
          updated_at: '2026-08-07T04:00:00.000Z',
        },
        error: null,
      },
    });
    const repo = new GridStrategyRepository(client);
    const meta = await repo.rename('strategy-1', ' 新名 ');

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '新名',
        updated_at: expect.any(String),
      })
    );
    expect(meta.name).toBe('新名');
  });

  it('删除 0 行视为不存在', async () => {
    const { client } = createClient({
      result: { data: null, error: null },
    });
    const repo = new GridStrategyRepository(client);
    await expect(repo.delete('missing')).rejects.toThrow('策略不存在或无权访问');
  });

  it('23505 映射为重名错误', async () => {
    const { client } = createClient({
      result: { data: null, error: { code: '23505', message: 'duplicate' } },
    });
    const repo = new GridStrategyRepository(client);
    await expect(repo.create('同名', buildPayload())).rejects.toThrow(
      '已有同名策略，请更换名称'
    );
  });

  it('会话失效抛明确中文错误', async () => {
    const { client } = createClient({ userId: null });
    const repo = new GridStrategyRepository(client);
    await expect(repo.list()).rejects.toThrow('登录状态已失效，请重新登录');
  });
});
