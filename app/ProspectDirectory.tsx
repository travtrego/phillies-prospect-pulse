'use client';

import { useMemo, useState } from 'react';

export type Player = {
  id: string;
  full_name: string;
  primary_position: string | null;
  current_level: string | null;
  current_team_name: string | null;
  mlb_pipeline_rank: number | null;
  estimated_arrival_year: number | null;
  bats: string | null;
  throws: string | null;
  source_name: string;
  source_last_verified_at: string | null;
  scouting_summary: string | null;
  scouting_grades: Record<string, number> | null;
  scouting_source_url: string | null;
  scouting_last_reviewed_at: string | null;
};

const filters = [
  ['top30', 'Top 30'],
  ['all', 'All Players'],
  ['AAA', 'AAA'],
  ['AA', 'AA'],
  ['A+', 'High-A'],
  ['A', 'Single-A'],
  ['pitchers', 'Pitchers'],
  ['hitters', 'Position Players']
] as const;

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('');
}

function formatDate(value: string | null) {
  if (!value) return 'Pending';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function isPitcher(position: string | null) {
  return ['P', 'RHP', 'LHP'].includes(position ?? '');
}

export default function ProspectDirectory({ players }: { players: Player[] }) {
  const [filter, setFilter] = useState('top30');
  const [search, setSearch] = useState('');

  const visiblePlayers = useMemo(() => {
    return players.filter((player) => {
      const matchesSearch = player.full_name.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (filter === 'top30') return player.mlb_pipeline_rank !== null;
      if (filter === 'all') return true;
      if (filter === 'pitchers') return isPitcher(player.primary_position);
      if (filter === 'hitters') return !isPitcher(player.primary_position);
      return player.current_level === filter;
    });
  }, [players, filter, search]);

  return (
    <>
      <section className="directoryToolbar">
        <div className="filterTabs" role="tablist" aria-label="Filter prospects">
          {filters.map(([value, label]) => (
            <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <input aria-label="Search players" placeholder="Search player…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </section>

      <div className="resultsHeader">
        <div>
          <span className="eyebrow">Player directory</span>
          <h2>{filters.find(([value]) => value === filter)?.[1]}</h2>
        </div>
        <span className="status">{visiblePlayers.length} players</span>
      </div>

      <section className="cardGrid">
        {visiblePlayers.map((player) => (
          <article className="playerCard" key={player.id}>
            <div className="cardTop">
              <span className="rank">{player.mlb_pipeline_rank ? `#${player.mlb_pipeline_rank}` : 'Unranked'}</span>
              <span className="level">{player.current_level ?? 'TBD'}</span>
            </div>
            <div className="playerIdentity">
              <div className="avatar">{initials(player.full_name)}</div>
              <div><h3>{player.full_name}</h3><p>{player.primary_position ?? 'Position TBD'}</p></div>
            </div>
            <div className="cardDetails">
              <div><span>Affiliate</span><strong>{player.current_team_name ?? 'TBD'}</strong></div>
              <div><span>Bats / Throws</span><strong>{player.bats ?? '—'} / {player.throws ?? '—'}</strong></div>
            </div>
            <div className="scoutingBlock">
              <div className="scoutingHeader"><h4>Scouting report</h4><span>{formatDate(player.scouting_last_reviewed_at)}</span></div>
              <p>{player.scouting_summary ?? 'A current public scouting report has not yet been added for this player.'}</p>
              {player.scouting_grades && <div className="grades">{Object.entries(player.scouting_grades).map(([tool, grade]) => <span key={tool}><b>{tool}</b>{grade}</span>)}</div>}
              {player.scouting_source_url && <a href={player.scouting_source_url} target="_blank" rel="noreferrer">View source report →</a>}
            </div>
            <footer><span>{player.source_name}</span><span>Checked {formatDate(player.source_last_verified_at)}</span></footer>
          </article>
        ))}
      </section>
    </>
  );
}
