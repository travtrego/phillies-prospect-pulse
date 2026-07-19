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
  scouting_summary: string | null;
  scouting_grades: Record<string, number> | null;
  scouting_source_url: string | null;
  scouting_last_reviewed_at: string | null;
};

async function getPlayers(): Promise<Player[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];

  const response = await fetch(
    `${url}/rest/v1/players?select=id,full_name,primary_position,current_level,mlb_pipeline_rank,estimated_arrival_year,bats,throws,source_name,source_last_verified_at,scouting_summary,scouting_grades,scouting_source_url,scouting_last_reviewed_at&order=mlb_pipeline_rank.asc.nullslast,full_name.asc`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 300 }
    }
  );

  if (!response.ok) throw new Error(`Unable to load players: ${response.status}`);
  return response.json();
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
}

function formatVerified(value: string | null) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default async function Home() {
  const players = await getPlayers();
  const rankedPlayers = players.filter((player) => player.mlb_pipeline_rank !== null);
  const hitters = players.filter((player) => !player.primary_position?.includes("HP"));
  const pitchers = players.filter((player) => player.primary_position?.includes("HP"));

  return (
    <main>
      <section className="hero">
        <div className="heroCopy">
          <div className="eyebrow">Philadelphia farm system</div>
          <h1>Prospect <span>Pulse</span></h1>
          <p>A Phillies-first player database covering the organization from Single-A through Triple-A, with concise current scouting reports for ranked prospects.</p>
        </div>
        <div className="heroMark" aria-hidden="true">P</div>
      </section>

      <section className="stats" aria-label="Database summary">
        <article><span>Players loaded</span><strong>{players.length}</strong></article>
        <article><span>Position players</span><strong>{hitters.length}</strong></article>
        <article><span>Pitchers</span><strong>{pitchers.length}</strong></article>
        <article><span>Scouting source</span><strong>MLB Pipeline</strong></article>
      </section>

      <section className="sectionHeading">
        <div><div className="eyebrow">Player directory</div><h2>Phillies prospect cards</h2></div>
        <span className="status">{rankedPlayers.length} ranked players</span>
      </section>

      {players.length === 0 ? (
        <div className="empty"><h3>Supabase connection is waiting.</h3><p>Add the public Supabase environment variables in Vercel to load the player database.</p></div>
      ) : (
        <section className="cardGrid">
          {players.map((player) => (
            <article className="playerCard" key={player.id}>
              <div className="cardTop">
                <span className="rank">{player.mlb_pipeline_rank ? `#${player.mlb_pipeline_rank}` : "Unranked"}</span>
                <span className="level">{player.current_level ?? "TBD"}</span>
              </div>

              <div className="playerIdentity">
                <div className="avatar">{initials(player.full_name)}</div>
                <div><h3>{player.full_name}</h3><p>{player.primary_position ?? "Position TBD"}</p></div>
              </div>

              <div className="cardDetails">
                <div><span>Bats / Throws</span><strong>{player.bats ?? "—"} / {player.throws ?? "—"}</strong></div>
                <div><span>Estimated arrival</span><strong>{player.estimated_arrival_year ?? "TBD"}</strong></div>
              </div>

              <div className="scoutingBlock">
                <div className="scoutingHeader">
                  <h4>Scouting report</h4>
                  <span>{formatVerified(player.scouting_last_reviewed_at)}</span>
                </div>
                <p>{player.scouting_summary ?? "A current public scouting report has not yet been added for this player."}</p>
                {player.scouting_grades && (
                  <div className="grades">
                    {Object.entries(player.scouting_grades).map(([tool, grade]) => (
                      <span key={tool}><b>{tool}</b>{grade}</span>
                    ))}
                  </div>
                )}
                {player.scouting_source_url && <a href={player.scouting_source_url} target="_blank" rel="noreferrer">View source report →</a>}
              </div>

              <footer><span>{player.source_name}</span><span>Player data checked {formatVerified(player.source_last_verified_at)}</span></footer>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
