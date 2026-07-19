'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Player } from '../ProspectDirectory';

const filters = [
  ['top30', 'Top 30'], ['all', 'All Players'], ['AAA', 'AAA'], ['AA', 'AA'], ['A+', 'High-A'], ['A', 'Single-A']
] as const;

export default function StatsDirectory({ players }: { players: Player[] }) {
  const [filter, setFilter] = useState('top30');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => players.filter((player) => {
    if (!player.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'top30') return player.mlb_pipeline_rank !== null;
    if (filter === 'all') return true;
    return player.current_level === filter;
  }), [players, filter, search]);

  return (
    <>
      <section className="directoryToolbar">
        <div className="filterTabs">
          {filters.map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <input placeholder="Search player…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </section>

      <div className="resultsHeader">
        <div><span className="eyebrow">Stat directory</span><h2>{filters.find(([value]) => value === filter)?.[1]}</h2></div>
        <span className="status">{visible.length} players</span>
      </div>

      <section className="statsCardGrid">
        {visible.map((player) => (
          <article className="statPlayerCard" key={player.id}>
            <div className="cardTop"><span className="rank">{player.mlb_pipeline_rank ? `#${player.mlb_pipeline_rank}` : 'Unranked'}</span><span className="level">{player.current_level ?? 'TBD'}</span></div>
            <div className="statIdentity"><h3>{player.full_name}</h3><p>{player.current_team_name ?? 'Affiliate TBD'} · {player.primary_position ?? 'Position TBD'}</p></div>
            <div className="statPlaceholderGrid">
              <div><span>Games</span><strong>—</strong></div>
              <div><span>{['P','RHP','LHP'].includes(player.primary_position ?? '') ? 'ERA' : 'AVG'}</span><strong>—</strong></div>
              <div><span>{['P','RHP','LHP'].includes(player.primary_position ?? '') ? 'Strikeouts' : 'OPS'}</span><strong>—</strong></div>
            </div>
            <Link className="statsLink" href={`/players/${player.id}`}>Open full player stats →</Link>
          </article>
        ))}
      </section>
    </>
  );
}
