import fs from 'node:fs/promises';

const OUTPUT = new URL('../data/stats.json', import.meta.url);
const SEASON = new Date().getUTCFullYear();
const TEAMS = [
  { id: 143, name: 'Philadelphia Phillies', level: 'MLB' },
  { id: 1410, name: 'Lehigh Valley IronPigs', level: 'AAA' },
  { id: 522, name: 'Reading Fightin Phils', level: 'AA' },
  { id: 427, name: 'Jersey Shore BlueClaws', level: 'A+' },
  { id: 566, name: 'Clearwater Threshers', level: 'A' },
  { id: 469, name: 'FCL Phillies', level: 'Rookie' }
];

const round = (value, digits = 3) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
};

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Phillies-Prospect-Pulse/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function getRoster(team) {
  const url = `https://statsapi.mlb.com/api/v1/teams/${team.id}/roster?rosterType=fullSeason&season=${SEASON}`;
  const data = await fetchJson(url);
  return (data.roster || []).map(entry => ({
    playerId: entry.person?.id,
    player: entry.person?.fullName,
    position: entry.position?.abbreviation || entry.position?.code || null,
    positionType: entry.position?.type || null,
    status: entry.status?.description || null,
    affiliate: team.name,
    level: team.level
  })).filter(player => player.playerId && player.player);
}

async function getStats(player) {
  const group = player.positionType === 'Pitcher' || ['P','RHP','LHP'].includes(player.position) ? 'pitching' : 'hitting';
  const url = `https://statsapi.mlb.com/api/v1/people/${player.playerId}/stats?stats=season&group=${group}&season=${SEASON}`;
  const data = await fetchJson(url);
  const split = data.stats?.[0]?.splits?.[0];
  const stat = split?.stat || {};

  if (group === 'pitching') {
    const innings = Number(stat.inningsPitched || 0);
    const strikeouts = Number(stat.strikeOuts || 0);
    const walks = Number(stat.baseOnBalls || 0);
    return {
      type: 'pitching',
      games: stat.gamesPlayed ?? stat.gamesPitched ?? null,
      gamesStarted: stat.gamesStarted ?? null,
      inningsPitched: stat.inningsPitched ?? null,
      era: round(stat.era),
      whip: round(stat.whip),
      strikeouts: stat.strikeOuts ?? null,
      walks: stat.baseOnBalls ?? null,
      hits: stat.hits ?? null,
      homeRuns: stat.homeRuns ?? null,
      saves: stat.saves ?? null,
      kPer9: innings > 0 ? round(strikeouts * 9 / innings, 2) : null,
      bbPer9: innings > 0 ? round(walks * 9 / innings, 2) : null,
      strikePercentage: round(stat.strikePercentage),
      sourceDate: split?.date || null
    };
  }

  const plateAppearances = Number(stat.plateAppearances || 0);
  const walks = Number(stat.baseOnBalls || 0);
  const strikeouts = Number(stat.strikeOuts || 0);
  return {
    type: 'hitting',
    games: stat.gamesPlayed ?? null,
    plateAppearances: stat.plateAppearances ?? null,
    atBats: stat.atBats ?? null,
    runs: stat.runs ?? null,
    hits: stat.hits ?? null,
    doubles: stat.doubles ?? null,
    triples: stat.triples ?? null,
    homeRuns: stat.homeRuns ?? null,
    rbi: stat.rbi ?? null,
    stolenBases: stat.stolenBases ?? null,
    caughtStealing: stat.caughtStealing ?? null,
    average: round(stat.avg),
    obp: round(stat.obp),
    slg: round(stat.slg),
    ops: round(stat.ops),
    walkRate: plateAppearances > 0 ? round(walks / plateAppearances * 100, 1) : null,
    strikeoutRate: plateAppearances > 0 ? round(strikeouts / plateAppearances * 100, 1) : null,
    sourceDate: split?.date || null
  };
}

const rosterResults = await Promise.allSettled(TEAMS.map(async team => ({ team, roster: await getRoster(team) })));
const players = [];
const errors = [];

for (const result of rosterResults) {
  if (result.status === 'fulfilled') players.push(...result.value.roster);
  else errors.push({ stage: 'roster', message: result.reason?.message || String(result.reason) });
}

const unique = [...new Map(players.map(player => [player.playerId, player])).values()];
const records = [];
const concurrency = 8;

for (let index = 0; index < unique.length; index += concurrency) {
  const batch = unique.slice(index, index + concurrency);
  const batchResults = await Promise.allSettled(batch.map(async player => ({ ...player, stats: await getStats(player) })));
  for (const result of batchResults) {
    if (result.status === 'fulfilled') records.push(result.value);
    else errors.push({ stage: 'stats', message: result.reason?.message || String(result.reason) });
  }
}

records.sort((a, b) => a.affiliate.localeCompare(b.affiliate) || a.player.localeCompare(b.player));
await fs.writeFile(OUTPUT, JSON.stringify({ updatedAt: new Date().toISOString(), season: SEASON, records, errors }, null, 2) + '\n');
console.log(`Wrote stats for ${records.length} players with ${errors.length} errors.`);
