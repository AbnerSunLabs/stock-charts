'use client';

import Link from 'next/link';

import type { TrackingEtf } from '@/lib/supabase/etf-pool-repository';

/**
 * 池子里跟踪当前指数的 ETF。已在组合里的才链到组合看板。
 */
export function IndexTrackingFunds({
  funds,
  held,
  phase,
}: {
  funds: TrackingEtf[];
  held: Set<string>;
  phase: 'loading' | 'ready' | 'error';
}) {
  return (
    <section className="card funds-card">
      <h2>跟踪这只指数的 ETF</h2>
      {phase === 'ready' && funds.length === 0 ? (
        <p className="empty-funds">池子里还没有跟踪这只指数的 ETF</p>
      ) : null}
      {funds.map(fund => (
        <div className="fund" key={fund.code}>
          <div>
            <b>{fund.name}</b>
            <span>{fund.code}</span>
          </div>
          {held.has(fund.code) ? <Link href="/view/grid">组合看板</Link> : <em>未纳入组合</em>}
        </div>
      ))}
    </section>
  );
}
