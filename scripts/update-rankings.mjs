import fs from 'node:fs/promises';

const OUTPUT = new URL('../data/rankings.json', import.meta.url);
const NEWS = new URL('../data/news.json', import.meta.url);
const INJURIES = new URL('../data/injuries.json', import.meta.url);
const PROMOTIONS = new URL('../data/promotions.json', import.meta.url);
const STATS = new URL('../data/stats.json', import.meta.url);

const LEVEL_POINTS = { MLB: 10, AAA: 9, AA: 7.5, 'A+': 6, A: 4.5, Rookie: 2 };
const POSITIVE = ['breakout','rising','surging','dominant','dominating','impressive','standout','hot','best','elite','star','steal','promoted','called up','top prospect'];
const NEGATIVE = ['struggling','slump','concern','injured','injury','setback','surgery','demoted','released','suspended'];
const SOURCE_WEIGHT = { 'MLB.com': 1.5, 'Baseball America': 1.5, 'FanGraphs': 1.45, 'The Athletic': 1.35, 'Sports Illustrated': 1.15, 'The Good Phight': 1.1 };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(value * 10) / 10;
const normalize = (value = '') => value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

async function readJson(url, fallback) {
  try { return JSON.parse(await fs.readFile(url, 'utf8')); } catch { return fallback; }
}

async function loadPlayers(statRecords) {
  const localPlayers = statRecords.map(record => ({
    id: record.playerId,
    full_name: record.player,
    primary_position: record.position,
    current_level: record.level,
    current_team_name: record.affiliate,
    mlb_pipeline_rank: null,
    estimated_arrival_year: null,
    scouting_grades: null,
    scouting_summary: null,
    stats: record.stats
  }));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.log('Supabase secrets not present; using local stats roster for rankings.');
    return localPlayers;
  }

  try {
    const endpoint = `${url}/rest/v1/players?select=id,full_name,primary_position,current_level,current_team_name,mlb_pipeline_rank,estimated_arrival_year,scouting_grades,scouting_summary&current_level=in.(AAA,AA,A%2B,A,Rookie)&order=full_name.asc`;
    const response = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    const enriched = await response.json();
    const statsById = new Map(localPlayers.map(player => [String(player.id), player.stats]));
    return enriched.map(player => ({ ...player, stats: statsById.get(String(player.id)) || null }));
  } catch (error) {
    console.warn(`Supabase enrichment failed; using local stats roster: ${error.message}`);
    return localPlayers;
  }
}

function scoutingScore(player) {
  const rank = Number(player.mlb_pipeline_rank);
  if (rank > 0) return clamp(31 - (rank - 1) * 0.72, 10, 30);
  const grades = player.scouting_grades && typeof player.scouting_grades === 'object'
    ? Object.values(player.scouting_grades).map(Number).filter(Number.isFinite)
    : [];
  return grades.length ? clamp((grades.reduce((a,b) => a+b, 0) / grades.length - 30) * 0.75, 8, 26) : 12;
}

function performanceScore(player) {
  const stats = player.stats || {};
  if (stats.type === 'hitting') {
    const ops = Number(stats.ops);
    const walkRate = Number(stats.walkRate);
    const strikeoutRate = Number(stats.strikeoutRate);
    const pa = Number(stats.plateAppearances);
    if (!Number.isFinite(ops) || pa < 10) return 12.5;
    const opsPoints = clamp((ops - 0.55) / 0.45 * 16, 0, 16);
    const discipline = clamp((walkRate - 4) / 12 * 5, 0, 5) + clamp((35 - strikeoutRate) / 20 * 4, 0, 4);
    const sample = clamp(pa / 150, 0.55, 1);
    return clamp((opsPoints + discipline) * sample, 4, 25);
  }

  if (stats.type === 'pitching') {
    const era = Number(stats.era);
    const whip = Number(stats.whip);
    const k9 = Number(stats.kPer9);
    const bb9 = Number(stats.bbPer9);
    const innings = Number(stats.inningsPitched);
    if (!Number.isFinite(era) || innings < 3) return 12.5;
    const runPrevention = clamp((6.5 - era) / 5 * 10, 0, 10) + clamp((1.8 - whip) / 0.9 * 6, 0, 6);
    const dominance = clamp((k9 - 4) / 10 * 6, 0, 6) + clamp((6 - bb9) / 5 * 3, 0, 3);
    const sample = clamp(innings / 40, 0.55, 1);
    return clamp((runPrevention + dominance) * sample, 4, 25);
  }

  return 12.5;
}

function sentimentScore(player, articles) {
  const name = normalize(player.full_name);
  const lastName = name.split(' ').at(-1);
  let raw = 0;
  let mentions = 0;
  const reasons = [];
  for (const article of articles) {
    const text = normalize(`${article.title || ''} ${article.summary || ''}`);
    if (!text.includes(name) && !(lastName?.length >= 5 && text.includes(lastName))) continue;
    mentions += 1;
    const ageDays = Math.max(0, (Date.now() - new Date(article.publishedAt || 0).getTime()) / 86400000);
    const recency = Math.exp(-ageDays / 30);
    const source = SOURCE_WEIGHT[article.source] || 0.85;
    const positive = POSITIVE.filter(word => text.includes(word)).length;
    const negative = NEGATIVE.filter(word => text.includes(word)).length;
    raw += (positive * 1.2 - negative * 1.3 + 0.25) * recency * source;
  }
  if (mentions) reasons.push(`${mentions} recent media mention${mentions === 1 ? '' : 's'}`);
  if (raw > 2.5) reasons.push('Strong positive media sentiment');
  if (raw < -1) reasons.push('Negative recent coverage');
  return { score: clamp(7.5 + raw, 0, 15), mentions, reasons };
}

function movementScore(player, promotions) {
  const matches = promotions.filter(item => normalize(item.player) === normalize(player.full_name));
  const latest = matches.sort((a,b) => String(b.date).localeCompare(String(a.date)))[0];
  if (!latest) return { score: 4, reasons: [] };
  const days = Math.max(0, (Date.now() - new Date(latest.date).getTime()) / 86400000);
  return { score: clamp(4 + 6 * Math.exp(-days / 75), 0, 10), reasons: [`Promoted to ${latest.toLevel || latest.toAffiliate}`] };
}

function riskScore(player, injuries) {
  const injury = injuries.find(item => normalize(item.player || item.name) === normalize(player.full_name));
  if (!injury) return { score: 5, reasons: [] };
  const status = normalize(`${injury.status || ''} ${injury.injury || injury.detail || ''}`);
  const severe = ['season ending','surgery','tommy john','60 day'].some(term => status.includes(term));
  return { score: severe ? 0.5 : 2.5, reasons: [severe ? 'Major injury risk' : 'Current injury lowers availability'] };
}

function ageLevelScore(player) {
  const proximity = LEVEL_POINTS[player.current_level || 'Rookie'] ?? 3;
  const arrival = Number(player.estimated_arrival_year);
  const currentYear = new Date().getUTCFullYear();
  const arrivalBonus = Number.isFinite(arrival) && arrival > 0 ? clamp(5 - Math.max(0, arrival - currentYear), 0, 5) : 2;
  return clamp(proximity + arrivalBonus, 0, 15);
}

const previous = await readJson(OUTPUT, { records: [] });
const news = await readJson(NEWS, { articles: [] });
const injuries = await readJson(INJURIES, { records: [] });
const promotions = await readJson(PROMOTIONS, { records: [] });
const statsData = await readJson(STATS, { records: [] });
const players = await loadPlayers(statsData.records || []);
const priorById = new Map((previous.records || []).map(item => [String(item.playerId), item]));

let records = players.map(player => {
  const sentiment = sentimentScore(player, news.articles || []);
  const movement = movementScore(player, promotions.records || []);
  const risk = riskScore(player, injuries.records || injuries.injuries || []);
  const components = {
    scouting: round(scoutingScore(player)),
    performance: round(performanceScore(player)),
    ageLevel: round(ageLevelScore(player)),
    sentiment: round(sentiment.score),
    movement: round(movement.score),
    risk: round(risk.score)
  };
  const score = round(Object.values(components).reduce((a,b) => a+b, 0));
  const prior = priorById.get(String(player.id));
  const reasons = [...sentiment.reasons, ...movement.reasons, ...risk.reasons];
  if (player.mlb_pipeline_rank) reasons.unshift(`MLB Pipeline rank #${player.mlb_pipeline_rank}`);
  if (components.performance >= 19) reasons.unshift('Strong current-season performance');
  if ((LEVEL_POINTS[player.current_level] || 0) >= 7.5) reasons.push(`Advanced to ${player.current_level}`);
  return {
    playerId: player.id,
    player: player.full_name,
    position: player.primary_position,
    affiliate: player.current_team_name,
    level: player.current_level,
    score,
    previousRank: prior?.rank ?? null,
    rank: 0,
    change: 0,
    components,
    mediaMentions: sentiment.mentions,
    reasons: reasons.slice(0, 4)
  };
});

records.sort((a,b) => b.score - a.score || a.player.localeCompare(b.player));
records = records.map((record, index) => {
  const rank = index + 1;
  return { ...record, rank, change: record.previousRank ? record.previousRank - rank : 0 };
});

await fs.writeFile(OUTPUT, JSON.stringify({
  updatedAt: new Date().toISOString(),
  methodology: { scouting: 30, performance: 25, ageLevel: 15, sentiment: 15, movement: 10, risk: 5, note: 'Rankings use the local daily stats roster and optionally enrich scouting fields from Supabase when secrets are available.' },
  records
}, null, 2) + '\n');

console.log(`Wrote ${records.length} prospect rankings.`);
