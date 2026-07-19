type Player = {
  id: string;
  full_name: string;
  primary_position: string | null;
  current_level: string | null;
  mlb_pipeline_rank: number | null;
  estimated_arrival_year: number | null;
  bats: string | null;
  throws: string | null;
  source_name: string;
  source_last_verified_at: string | null;
};

async function getPlayers(): Promise<Player[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return [];

  const response = await fetch(
    `${url}/rest/v1/players?select=id,full_name,primary_position,current_level,mlb_pipeline_rank,estimated_arrival_year,bats,throws,source_name,source_last_verified_at&order=mlb_pipeline_rank.asc.nullslast,full_name.asc`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      },
      next: { revalidate: 300 }
    }
  );

  if (!response.ok) {
    throw new Error(`Unable to load players: ${response.status}`);
  }

  return response.json();
}

function formatVerified(value: string | null) {
  if (!value) return "Not verified";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export default async function Home() {
  const players = await getPlayers();
  const rankedPlayers = players.filter((player) => player.mlb_pipeline_rank !== null);

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Phillies farm system tracker</div>
        <h1>Prospect Pulse</h1>
        <p>
          A clean, source-tracked master list of Philadelphia Phillies prospects.
          We are starting with durable player data before adding automated updates.
        </p>
      </section>

      <section className="stats" aria-label="Database summary">
        <article>
          <span>Players loaded</span>
          <strong>{players.length}</strong>
        </article>
        <article>
          <span>Pipeline ranked</span>
          <strong>{rankedPlayers.length}</strong>
        </article>
        <article>
          <span>Data source</span>
          <strong>MLB Pipeline</strong>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="eyebrow">Phase 1</div>
            <h2>Player master</h2>
          </div>
          <span className="status">Manual verification</span>
        </div>

        {players.length === 0 ? (
          <div className="empty">
            <h3>Supabase connection is waiting.</h3>
            <p>Add the two public Supabase environment variables in Vercel to load the player database.</p>
          </div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Pos</th>
                  <th>Level</th>
                  <th>B/T</th>
                  <th>ETA</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => (
                  <tr key={player.id}>
                    <td><span className="rank">{player.mlb_pipeline_rank ?? "—"}</span></td>
                    <td><strong>{player.full_name}</strong><small>{player.source_name}</small></td>
                    <td>{player.primary_position ?? "—"}</td>
                    <td><span className="level">{player.current_level ?? "—"}</span></td>
                    <td>{player.bats ?? "—"}/{player.throws ?? "—"}</td>
                    <td>{player.estimated_arrival_year ?? "—"}</td>
                    <td>{formatVerified(player.source_last_verified_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
