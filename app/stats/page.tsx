import type { Player } from '../ProspectDirectory';
import StatsDirectory from './StatsDirectory';

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

export default async function StatsPage() {
  const players = await getPlayers();

  return (
    <main>
      <header className="pageHeader">
        <span className="eyebrow">Player performance</span>
        <h1>Stats</h1>
        <p>Browse the system using the same filters as the scouting directory, then open each player’s full stat page.</p>
      </header>
      <StatsDirectory players={players} />
    </main>
  );
}
