import Link from 'next/link';
import type { Player } from '../ProspectDirectory';

async function getPlayers(): Promise<Player[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  const response = await fetch(`${url}/rest/v1/players?select=id,full_name,primary_position,current_level,current_team_name,mlb_pipeline_rank,estimated_arrival_year,bats,throws,source_name,source_last_verified_at,scouting_summary,scouting_grades,scouting_source_url,scouting_last_reviewed_at&current_level=in.(AAA,AA,A%2B,A)&order=current_level.desc,mlb_pipeline_rank.asc.nullslast,full_name.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 300 } });
  if (!response.ok) return [];
  return response.json();
}

const levels = [
  ['AAA', 'Lehigh Valley IronPigs', 'Triple-A'],
  ['AA', 'Reading Fightin Phils', 'Double-A'],
  ['A+', 'Jersey Shore BlueClaws', 'High-A'],
  ['A', 'Clearwater Threshers', 'Single-A']
] as const;

export default async function AffiliatesPage() {
  const players = await getPlayers();
  return (
    <main>
      <header className="pageHeader"><span className="eyebrow">Organizational depth</span><h1>Affiliates</h1><p>Roster composition, prospect concentration and development context across the full-season system.</p></header>
      <section className="affiliateGrid">
        {levels.map(([level, team, label]) => {
          const roster = players.filter((player) => player.current_level === level);
          const ranked = roster.filter((player) => player.mlb_pipeline_rank !== null);
          const pitchers = roster.filter((player) => ['P','RHP','LHP'].includes(player.primary_position ?? '')).length;
          return (
            <article className="affiliateCard" key={level}>
              <div className="affiliateTop"><span>{level}</span><div><small>{label}</small><h2>{team}</h2></div></div>
              <div className="affiliateMetrics"><div><span>Roster</span><strong>{roster.length}</strong></div><div><span>Top 30</span><strong>{ranked.length}</strong></div><div><span>Pitchers</span><strong>{pitchers}</strong></div></div>
              <div className="affiliateProspects"><span>Highest-ranked prospects</span>{ranked.slice(0,4).map((player) => <Link href={`/players/${player.id}`} key={player.id}><b>#{player.mlb_pipeline_rank}</b>{player.full_name}</Link>)}{ranked.length === 0 && <p>No ranked players currently assigned.</p>}</div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
