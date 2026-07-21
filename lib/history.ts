export type RankSnapshotPoint = { capturedAt: string; rank: number | null; score: number | null };

export async function fetchRankHistory(playerName: string): Promise<RankSnapshotPoint[]> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const query = new URLSearchParams({
    select: 'captured_at,organization_rank,ranking_score',
    player_name: `eq.${playerName}`,
    order: 'captured_at.asc',
    limit: '180'
  });
  try {
    const response = await fetch(`${url}/rest/v1/player_snapshots?${query.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store'
    });
    if (!response.ok) return [];
    const rows = await response.json();
    return (rows as any[]).map((row) => ({
      capturedAt: row.captured_at,
      rank: row.organization_rank ?? null,
      score: row.ranking_score ?? null
    }));
  } catch {
    return [];
  }
}
