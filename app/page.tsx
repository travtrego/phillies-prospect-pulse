import Link from 'next/link';
import ProspectDirectory, { type Player } from './ProspectDirectory';

async function getPlayers(): Promise<Player[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];

  const response = await fetch(
    `${url}/rest/v1/players?select=id,full_name,primary_position,current_level,current_team_name,mlb_pipeline_rank,estimated_arrival_year,bats,throws,source_name,source_last_verified_at,scouting_summary,scouting_grades,scouting_source_url,scouting_last_reviewed_at&current_level=in.(AAA,AA,A%2B,A)&order=mlb_pipeline_rank.asc.nullslast,full_name.asc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 300 } }
  );

  if (!response.ok) throw new Error(`Unable to load players: ${response.status}`);
  return response.json();
}

export default async function Home() {
  const players = await getPlayers();
  const rankedPlayers = players.filter((player) => player.mlb_pipeline_rank !== null);
  const pitchers = players.filter((player) => ['P', 'RHP', 'LHP'].includes(player.primary_position ?? '')).length;
  const affiliates = new Set(players.map((player) => player.current_team_name).filter(Boolean)).size;

  return (
    <main>
      <header className="siteHeader commandHero">
        <div>
          <div className="eyebrow">Philadelphia Phillies farm system</div>
          <h1>Prospect Pulse</h1>
          <p>An intelligent command center for scouting, performance, organizational movement and year-round prospect coverage.</p>
        </div>
        <div className="headerBadge"><span>Top 30</span><strong>{rankedPlayers.length}</strong></div>
      </header>

      <section className="commandMetrics" aria-label="System overview">
        <div><span>Tracked players</span><strong>{players.length}</strong><small>Full-season system</small></div>
        <div><span>Ranked prospects</span><strong>{rankedPlayers.length}</strong><small>Current Top 30</small></div>
        <div><span>Pitchers</span><strong>{pitchers}</strong><small>Across all levels</small></div>
        <div><span>Affiliates</span><strong>{affiliates}</strong><small>AAA through Single-A</small></div>
      </section>

      <section className="changeCenter">
        <div className="sectionIntro">
          <div><span className="eyebrow">Since your last visit</span><h2>Farm system movement</h2></div>
          <span className="dataStatusPill">Snapshot framework ready</span>
        </div>
        <div className="changeGrid">
          <article><span className="changeIcon up">↑</span><div><strong>Promotions</strong><p>Player assignments and level changes will appear here.</p></div><b>—</b></article>
          <article><span className="changeIcon health">+</span><div><strong>Injury updates</strong><p>IL placements, activations and reported health context.</p></div><b>—</b></article>
          <article><span className="changeIcon rankMove">↗</span><div><strong>Ranking movement</strong><p>Changes across selected public prospect lists.</p></div><b>—</b></article>
          <article><span className="changeIcon trend">⌁</span><div><strong>Performance alerts</strong><p>Breakouts, slumps and playing-time changes.</p></div><b>—</b></article>
        </div>
      </section>

      <section className="dashboardSplit">
        <div className="newsPanel newsPanelFull">
          <div className="panelHeading">
            <div><span className="eyebrow">Breaking news</span><h2>Top Phillies prospect stories</h2></div>
            <Link className="sectionLink" href="/news">View all news →</Link>
          </div>
          <ol className="storyList storyListWide">
            {[1, 2, 3, 4, 5].map((story) => (
              <li key={story}><span>{story}</span><div><strong>Phillies prospect news placeholder</strong><p>AI-ready summary, source, timestamp and related players will appear here.</p></div></li>
            ))}
          </ol>
        </div>

        <aside className="dailyBriefCard">
          <span className="eyebrow">Daily farm report</span>
          <h2>Morning briefing</h2>
          <p>A concise summary of promotions, injuries, standout performances and organizational news.</p>
          <div className="briefChecklist"><span>Promotions</span><span>Injuries</span><span>Top performers</span><span>Stock movement</span></div>
          <Link href="/reports">Open reports hub →</Link>
        </aside>
      </section>

      <section className="trendPreview">
        <div className="sectionIntro">
          <div><span className="eyebrow">Development monitor</span><h2>Stock Up / Stock Down</h2></div>
          <Link className="sectionLink" href="/methodology">View methodology →</Link>
        </div>
        <div className="trendColumns">
          <article><span className="trendLabel positive">Stock up</span><h3>Risers will appear here</h3><p>Recent performance, age-to-level, playing time, promotions and ranking movement will feed transparent trend scores.</p></article>
          <article><span className="trendLabel negative">Stock down</span><h3>Fallers will appear here</h3><p>Slumps, reduced playing time, injuries and negative ranking movement will be explained with supporting evidence.</p></article>
        </div>
      </section>

      {players.length === 0 ? (
        <div className="empty"><h3>Supabase connection is waiting.</h3><p>Add the public Supabase environment variables in Vercel to load the player database.</p></div>
      ) : <ProspectDirectory players={players} />}

      <section className="featureRail">
        <Link href="/affiliates"><span>Organization</span><strong>Affiliate dashboards</strong><p>Depth, roster composition and top prospects by level.</p></Link>
        <Link href="/compare"><span>Analysis</span><strong>Player comparison</strong><p>Compare rank, tools, level, ETA and performance.</p></Link>
        <Link href="/offseason"><span>Year-round</span><strong>Offseason tracker</strong><p>Rule 5, winter leagues, signings and spring invitations.</p></Link>
      </section>
    </main>
  );
}
