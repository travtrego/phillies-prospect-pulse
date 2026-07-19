'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type RankingRecord = {
  playerId: string;
  player: string;
  position: string | null;
  affiliate: string | null;
  level: string | null;
  score: number;
  previousRank: number | null;
  rank: number;
  change: number;
  mediaMentions: number;
  reasons: string[];
};

export default function RankingsTable({ records }: { records: RankingRecord[] }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'rank' | 'score' | 'change'>('rank');

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records
      .filter((record) => !query || record.player.toLowerCase().includes(query) || (record.position ?? '').toLowerCase().includes(query) || (record.level ?? '').toLowerCase().includes(query))
      .sort((a, b) => sort === 'score' ? b.score - a.score : sort === 'change' ? b.change - a.change : a.rank - b.rank);
  }, [records, search, sort]);

  return (
    <>
      <section className="directoryToolbar rankingsToolbar">
        <div className="filterTabs">
          <button className={sort === 'rank' ? 'active' : ''} onClick={() => setSort('rank')}>Current rank</button>
          <button className={sort === 'score' ? 'active' : ''} onClick={() => setSort('score')}>Pulse score</button>
          <button className={sort === 'change' ? 'active' : ''} onClick={() => setSort('change')}>Movement</button>
        </div>
        <input aria-label="Search rankings" placeholder="Search player…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </section>

      <div className="rankingTableWrap">
        <table className="rankingTable">
          <thead><tr><th>Rank</th><th>Player</th><th>Pos.</th><th>Level</th><th>Affiliate</th><th>Previous</th><th>Trend</th><th>Score</th></tr></thead>
          <tbody>
            {visible.map((record) => {
              const trend = record.change > 0 ? `▲ ${record.change}` : record.change < 0 ? `▼ ${Math.abs(record.change)}` : '—';
              const trendClass = record.change > 0 ? 'trendUp' : record.change < 0 ? 'trendDown' : 'trendFlat';
              return (
                <tr key={record.playerId}>
                  <td><strong className="rankingNumber">#{record.rank}</strong></td>
                  <td><Link className="rankingPlayer" href={`/players/${record.playerId}`}>{record.player}</Link></td>
                  <td>{record.position ?? '—'}</td><td>{record.level ?? '—'}</td><td>{record.affiliate ?? '—'}</td>
                  <td>{record.previousRank ? `#${record.previousRank}` : 'New'}</td>
                  <td><span className={trendClass}>{trend}</span></td>
                  <td><strong>{record.score.toFixed(1)}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
