import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Player } from '../../ProspectDirectory';

async function getPlayer(id: string): Promise<Player | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const response = await fetch(
    `${url}/rest/v1/players?select=id,full_name,primary_position,current_level,current_team_name,mlb_pipeline_rank,estimated_arrival_year,bats,throws,source_name,source_last_verified_at,scouting_summary,scouting_grades,scouting_source_url,scouting_last_reviewed_at&id=eq.${id}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 300 } }
  );

  if (!response.ok) return null;
  const players = await response.json();
  return players[0] ?? null;
}

export default async function PlayerStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();

  const pitcher = ['P', 'RHP', 'LHP'].includes(player.primary_position ?? '');

  return (
    <main>
      <Link className="backLink" href="/stats">← Back to stats</Link>
      <header className="playerPageHeader">
        <div>
          <span className="eyebrow">{player.current_team_name ?? 'Phillies organization'}</span>
          <h1>{player.full_name}</h1>
          <p>{player.primary_position ?? 'Position TBD'} · {player.current_level ?? 'Level TBD'} · {player.bats ?? '—'}/{player.throws ?? '—'}</p>
        </div>
        <div className="headerBadge"><span>Rank</span><strong>{player.mlb_pipeline_rank ?? '—'}</strong></div>
      </header>

      <section className="personalStatsPanel">
        <div className="panelHeading"><div><span className="eyebrow">Current season</span><h2>Player statistics</h2></div><span className="liveBadge">Coming soon</span></div>
        <div className="personalStatsGrid">
          {(pitcher ? ['Games', 'Innings', 'ERA', 'Strikeouts', 'WHIP', 'Walk rate'] : ['Games', 'Plate appearances', 'AVG', 'OBP', 'SLG', 'OPS']).map((label) => (
            <div key={label}><span>{label}</span><strong>—</strong></div>
          ))}
        </div>
      </section>

      <section className="playerReportPanel">
        <span className="eyebrow">Scouting report</span>
        <h2>Current evaluation</h2>
        <p>{player.scouting_summary ?? 'A current public scouting report has not yet been added for this player.'}</p>
      </section>
    </main>
  );
}
