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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function formatVerified(value: string | null) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
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
          <p>
            A Phillies-first dashboard for tracking the organization&apos;s most important young players,
            their current level, ETA and movement through the system.
          </p>
        </div>
        <div className="heroMark" aria-hidden="true">P</div>
      </section>

      <section className="stats" aria-label="Database summary">
        <article>
          <span>Prospects loaded</span>
          <strong>{players.length}</strong>
        </article>
        <article>
          <span>Position players</span>
          <strong>{hitters.length}</strong>
        </article>
        <article>
          <span>Pitchers</span>
          <strong>{pitchers.length}</strong>
        </article>
        <article>
          <span>Source</span>
          <strong>MLB Pipeline</strong>
        </article>
      </section>

      <section className="sectionHeading">
        <div>
          <div className="eyebrow">Top of the system</div>
          <h2>Phillies prospect cards</h2>
        </div>
        <span className="status">{rankedPlayers.length} ranked players</span>
      </section>

      {players.length === 0 ? (
        <div className="empty">
          <h3>Supabase connection is waiting.</h3>
          <p>Add the two public Supabase environment variables in Vercel to load the player database.</p>
        </div>
      ) : (
        <section className="cardGrid">
          {players.map((player) => (
            <article className="playerCard" key={player.id}>
              <div className="cardTop">
                <span className="rank">#{player.mlb_pipeline_rank ?? "—"}</span>
                <span className="level">{player.current_level ?? "TBD"}</span>
              </div>

              <div className="playerIdentity">
                <div className="avatar">{initials(player.full_name)}</div>
                <div>
                  <h3>{player.full_name}</h3>
                  <p>{player.primary_position ?? "Position TBD"}</p>
                </div>
              </div>

              <div className="cardDetails">
                <div>
                  <span>Bats / Throws</span>
                  <strong>{player.bats ?? "—"} / {player.throws ?? "—"}</strong>
                </div>
                <div>
                  <span>Estimated arrival</span>
                  <strong>{player.estimated_arrival_year ?? "TBD"}</strong>
                </div>
              </div>

              <footer>
                <span>{player.source_name}</span>
                <span>Checked {formatVerified(player.source_last_verified_at)}</span>
              </footer>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
