import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Player } from '../../ProspectDirectory';
import statsData from '../../../data/stats.json';
import injuriesData from '../../../data/injuries.json';
import promotionsData from '../../../data/promotions.json';

type StatValue = string | number | null | undefined;

type StatRecord = {
  playerId: number;
  player: string;
  affiliate: string;
  level: string;
  position: string | null;
  status: string | null;
  stats: {
    type: string;
    [key: string]: StatValue;
  };
};

type InjuryRecord = {
  playerId?: number;
  player: string;
  injury: string;
  timeline: string;
  status: string;
  source?: string;
  transactionDate?: string;
  injurySourceType?: string;
};

type PromotionRecord = {
  playerId?: number;
  player: string;
  date: string;
  fromAffiliate: string;
  fromLevel: string;
  toAffiliate: string;
  toLevel: string;
  description?: string;
  source?: string;
};

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

function formatDate(value: string | null | undefined) {
  if (!value) return 'Pending review';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function sameName(a: string, b: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalize(a) === normalize(b);
}

function samePlayer(recordId: number | undefined, recordName: string, playerId: string, playerName: string) {
  return String(recordId ?? '') === String(playerId) || sameName(recordName, playerName);
}

function displayStat(value: StatValue, decimals = false) {
  if (value === null || value === undefined || value === '') return '—';
  if (decimals && typeof value === 'number') return value.toFixed(3).replace(/^0/, '');
  return String(value);
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();

  const statRecords = statsData.records as unknown as StatRecord[];
  const statRecord = statRecords.find(record => samePlayer(record.playerId, record.player, id, player.full_name));
  const injury = (injuriesData.records as InjuryRecord[]).find(record => samePlayer(record.playerId, record.player, id, player.full_name));
  const promotions = (promotionsData.records as PromotionRecord[])
    .filter(record => samePlayer(record.playerId, record.player, id, player.full_name))
    .sort((a, b) => b.date.localeCompare(a.date));
  const pitcher = statRecord?.stats.type === 'pitching' || ['P', 'RHP', 'LHP'].includes(player.primary_position ?? '');

  const statItems: Array<[string, StatValue]> = pitcher
    ? [
        ['G', statRecord?.stats.games],
        ['GS', statRecord?.stats.gamesStarted],
        ['IP', statRecord?.stats.inningsPitched],
        ['ERA', statRecord?.stats.era],
        ['WHIP', statRecord?.stats.whip],
        ['SO', statRecord?.stats.strikeouts],
        ['BB', statRecord?.stats.walks],
        ['K/9', statRecord?.stats.kPer9]
      ]
    : [
        ['G', statRecord?.stats.games],
        ['PA', statRecord?.stats.plateAppearances],
        ['AVG', statRecord?.stats.average],
        ['OBP', statRecord?.stats.obp],
        ['SLG', statRecord?.stats.slg],
        ['OPS', statRecord?.stats.ops],
        ['HR', statRecord?.stats.homeRuns],
        ['SB', statRecord?.stats.stolenBases]
      ];

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
          <div><span className="eyebrow">{statsData.season} season</span><h2>Current stats</h2></div>
          <span className="dataStatusPill">{statRecord ? `${statRecord.affiliate} · Updated ${formatDate(statsData.updatedAt)}` : 'No current stat line found'}</span>
        </div>
        <div className="personalStatsGrid">
          {statItems.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{displayStat(value, ['AVG', 'OBP', 'SLG', 'OPS', 'ERA', 'WHIP'].includes(label))}</strong>
            </div>
          ))}
        </div>
        {statRecord && !pitcher && (
          <p className="statsFootnote">BB% {displayStat(statRecord.stats.walkRate)} · K% {displayStat(statRecord.stats.strikeoutRate)} · RBI {displayStat(statRecord.stats.rbi)}</p>
        )}
        {statRecord && pitcher && (
          <p className="statsFootnote">BB/9 {displayStat(statRecord.stats.bbPer9)} · H {displayStat(statRecord.stats.hits)} · HR {displayStat(statRecord.stats.homeRuns)}</p>
        )}
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
          {injury ? (
            <div className="profileDataBlock">
              <strong>{injury.injury}</strong>
              <p>{injury.timeline}</p>
              <p>{injury.status}</p>
              <small>{injury.transactionDate ? `Recorded ${formatDate(injury.transactionDate)}` : injury.injurySourceType}</small>
            </div>
          ) : (
            <div className="emptyStateCompact"><strong>No active injury note</strong><p>No current injured-list transaction or verified injury report was found.</p></div>
          )}
          <Link className="sourceButton" href="/injuries">View full injury report →</Link>
        </article>

        <article className="placeholderPanel" id="movement">
          <span className="eyebrow">Roster history</span>
          <h2>Transactions</h2>
          {promotions.length > 0 ? (
            <ol className="profileTimeline">
              {promotions.map(record => (
                <li key={`${record.date}-${record.fromAffiliate}-${record.toAffiliate}`}>
                  <time>{formatDate(record.date)}</time>
                  <strong>{record.fromLevel} → {record.toLevel}</strong>
                  <p>{record.fromAffiliate} to {record.toAffiliate}</p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="emptyStateCompact"><strong>No recorded promotions yet</strong><p>Future affiliate promotions will appear here automatically.</p></div>
          )}
        </article>
      </section>

      <footer className="profileSourceFooter">
        <span>Primary roster source: {player.source_name}</span>
        <span>Last checked: {formatDate(player.source_last_verified_at)}</span>
      </footer>
    </main>
  );
}
