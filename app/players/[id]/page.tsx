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

function formatDate(value: string | null) {
  if (!value) return 'Pending review';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();

  const pitcher = ['P', 'RHP', 'LHP'].includes(player.primary_position ?? '');
  const statLabels = pitcher
    ? ['G', 'IP', 'ERA', 'SO', 'WHIP', 'BB%']
    : ['G', 'PA', 'AVG', 'OBP', 'SLG', 'OPS'];

  return (
    <main>
      <Link className="backLink" href="/">← Back to prospect directory</Link>

      <header className="playerPageHeader premiumHeader">
        <div className="profileHeroCopy">
          <div className="profileStatusRow">
            <span className="eyebrow">{player.current_team_name ?? 'Phillies organization'}</span>
          </div>
          <h1>{player.full_name}</h1>
          <p>{player.primary_position ?? 'Position TBD'} · {player.current_level ?? 'Level TBD'} · Bats {player.bats ?? '—'} · Throws {player.throws ?? '—'}</p>
          <div className="profileQuickFacts">
            <span><b>Affiliate</b>{player.current_team_name ?? 'TBD'}</span>
            <span><b>ETA</b>{player.estimated_arrival_year ?? 'TBD'}</span>
            <span><b>Last verified</b>{formatDate(player.source_last_verified_at)}</span>
          </div>
        </div>
        <div className="headerBadge"><span>Org rank</span><strong>{player.mlb_pipeline_rank ?? '—'}</strong></div>
      </header>

      <nav className="profileSubnav" aria-label="Player profile sections">
        <a href="#stats">Stats</a>
        <a href="#scouting">Scouting</a>
        <a href="#injury">Injury notes</a>
        <a href="#movement">Transactions</a>
      </nav>

      <section className="personalStatsPanel" id="stats">
        <div className="panelHeading">
          <div><span className="eyebrow">2026 season</span><h2>Current stats</h2></div>
          <span className="dataStatusPill">Data source pending</span>
        </div>
        <div className="personalStatsGrid">
          {statLabels.map((label) => <div key={label}><span>{label}</span><strong>—</strong></div>)}
        </div>
      </section>

      <section className="playerReportPanel" id="scouting">
        <div className="panelHeading">
          <div><span className="eyebrow">Scouting report</span><h2>Current evaluation</h2></div>
          <span className="reviewDate">Reviewed {formatDate(player.scouting_last_reviewed_at)}</span>
        </div>
        <p>{player.scouting_summary ?? 'A current public scouting report has not yet been added for this player.'}</p>
        {player.scouting_grades && (
          <div className="profileGrades">
            {Object.entries(player.scouting_grades).map(([tool, grade]) => (
              <div key={tool}><span>{tool}</span><strong>{grade}</strong><div><i style={{ width: `${Math.min(100, grade * 1.25)}%` }} /></div></div>
            ))}
          </div>
        )}
        {player.scouting_source_url && <a className="sourceButton" href={player.scouting_source_url} target="_blank" rel="noreferrer">Open original scouting source →</a>}
      </section>

      <section className="profileTwoColumn">
        <article className="placeholderPanel" id="injury">
          <span className="eyebrow">Quick health note</span>
          <h2>Injury status</h2>
          <div className="emptyStateCompact">
            <strong>No active injury note</strong>
            <p>Any current injured-list status or return estimate will appear here.</p>
          </div>
          <Link className="sourceButton" href="/injuries">View full injury report →</Link>
        </article>

        <article className="placeholderPanel" id="movement">
          <span className="eyebrow">Roster history</span>
          <h2>Transactions</h2>
          <div className="emptyStateCompact"><strong>No timeline loaded yet</strong><p>Promotions, demotions, injured-list placements and activations will appear here.</p></div>
        </article>
      </section>

      <footer className="profileSourceFooter">
        <span>Primary roster source: {player.source_name}</span>
        <span>Last checked: {formatDate(player.source_last_verified_at)}</span>
      </footer>
    </main>
  );
}
