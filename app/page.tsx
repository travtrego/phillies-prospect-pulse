import ProspectDirectory, { type Player } from './ProspectDirectory';

async function getPlayers(): Promise<Player[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];

  const response = await fetch(
    `${url}/rest/v1/players?select=id,full_name,primary_position,current_level,current_team_name,mlb_pipeline_rank,estimated_arrival_year,bats,throws,source_name,source_last_verified_at,scouting_summary,scouting_grades,scouting_source_url,scouting_last_reviewed_at&current_level=in.(AAA,AA,A%2B,A)&order=mlb_pipeline_rank.asc.nullslast,full_name.asc`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 300 }
    }
  );

  if (!response.ok) throw new Error(`Unable to load players: ${response.status}`);
  return response.json();
}

export default async function Home() {
  const players = await getPlayers();
  const rankedPlayers = players.filter((player) => player.mlb_pipeline_rank !== null);

  return (
    <main>
      <header className="siteHeader">
        <div>
          <div className="eyebrow">Philadelphia Phillies farm system</div>
          <h1>Prospect Pulse</h1>
          <p>Top prospects and full-season rosters, organized in one clean directory.</p>
        </div>
        <div className="headerBadge">
          <span>Top 30</span>
          <strong>{rankedPlayers.length}</strong>
        </div>
      </header>

      <section className="newsDashboard">
        <div className="newsPanel">
          <div className="panelHeading">
            <div>
              <span className="eyebrow">Breaking news</span>
              <h2>Top prospect stories</h2>
            </div>
            <span className="liveBadge">Top 5</span>
          </div>
          <ol className="storyList">
            {[1, 2, 3, 4, 5].map((story) => (
              <li key={story}>
                <span>{story}</span>
                <strong>Phillies prospect news placeholder</strong>
              </li>
            ))}
          </ol>
        </div>

        <aside className="rumorsPanel">
          <div className="panelHeading compact">
            <div>
              <span className="eyebrow">Rumor mill</span>
              <h2>Prospect rumors</h2>
            </div>
          </div>
          <ol className="rumorList">
            {[1, 2, 3, 4, 5].map((rumor) => (
              <li key={rumor}><span>{rumor}</span><p>Rumor placeholder</p></li>
            ))}
          </ol>
        </aside>
      </section>

      {players.length === 0 ? (
        <div className="empty">
          <h3>Supabase connection is waiting.</h3>
          <p>Add the public Supabase environment variables in Vercel to load the player database.</p>
        </div>
      ) : (
        <ProspectDirectory players={players} />
      )}

      <div className="directoryNote">Stats, injury status and news are intentionally excluded from this version.</div>
    </main>
  );
}
