import fs from 'node:fs/promises';

const OUTPUT = new URL('../data/rankings.json', import.meta.url);
const NEWS = new URL('../data/news.json', import.meta.url);
const INJURIES = new URL('../data/injuries.json', import.meta.url);
const PROMOTIONS = new URL('../data/promotions.json', import.meta.url);
const STATS = new URL('../data/stats.json', import.meta.url);

const LEVEL_POINTS = { MLB: 7, AAA: 6.3, AA: 5.2, 'A+': 4.1, A: 3, Rookie: 1.5 };

const POSITIVE_SENTIMENT = [
  ['elite', 2.4], ['future star', 2.4], ['star potential', 2.2], ['frontline starter', 2.2], ['top of the rotation', 2.2],
  ['middle of the order', 2.1], ['impact player', 2.1], ['premium prospect', 2], ['blue chip', 2], ['untouchable', 1.9],
  ['breakout', 1.8], ['breaking out', 1.8], ['surging', 1.7], ['red hot', 1.7], ['on fire', 1.7], ['dominant', 1.7],
  ['dominating', 1.7], ['overpowering', 1.6], ['electric', 1.6], ['lights out', 1.6], ['filthy', 1.5], ['nasty', 1.4],
  ['impressive', 1.4], ['standout', 1.4], ['stock up', 1.4], ['rising', 1.3], ['ascending', 1.3], ['fast riser', 1.5],
  ['helium', 1.5], ['buzz', 1], ['turning heads', 1.4], ['opened eyes', 1.3], ['making noise', 1.2], ['gaining momentum', 1.2],
  ['best steal', 1.6], ['steal of the draft', 1.7], ['draft steal', 1.5], ['sleeper', 1.1], ['hidden gem', 1.3],
  ['toolsy', 1], ['five tool', 1.6], ['plus power', 1.3], ['plus hit tool', 1.4], ['plus defender', 1.2], ['plus athlete', 1.2],
  ['advanced approach', 1.2], ['strong approach', 1.1], ['plate discipline', 1], ['barrel', 0.7], ['hard contact', 1], ['exit velocity', 0.7],
  ['home run', 0.7], ['homer', 0.7], ['multi hit', 0.8], ['extra base hit', 0.7], ['walk off', 1], ['stole', 0.4],
  ['scoreless', 0.8], ['shutout', 1], ['quality start', 1], ['career high', 1.1], ['double digit strikeouts', 1.3],
  ['strikeout', 0.35], ['whiff', 0.5], ['velocity up', 1.3], ['added velocity', 1.3], ['command improved', 1.2], ['improved command', 1.2],
  ['healthy', 0.8], ['returned', 0.6], ['activated', 0.8], ['reinstated', 0.8], ['rehab assignment', 0.3],
  ['promoted', 1.2], ['promotion', 1], ['called up', 1.4], ['call up', 1.2], ['major league ready', 1.8], ['mlb ready', 1.7],
  ['close to the majors', 1.3], ['pushing for a callup', 1.3], ['forcing the issue', 1.2], ['top prospect', 0.8],
  ['top 100', 1], ['ranked prospect', 0.8], ['award winner', 1.4], ['player of the week', 1.4], ['pitcher of the week', 1.4]
];

const NEGATIVE_SENTIMENT = [
  ['season ending', 3], ['tommy john', 3], ['underwent surgery', 2.8], ['needs surgery', 2.8], ['major surgery', 2.8],
  ['significant injury', 2.4], ['serious injury', 2.4], ['setback', 2.1], ['shut down', 2], ['out indefinitely', 2.2],
  ['long term absence', 2.1], ['60 day injured list', 2.2], ['transferred to the 60 day', 2.2], ['injured list', 1.2],
  ['injury', 1], ['injured', 1.1], ['soreness', 0.8], ['tightness', 0.8], ['inflammation', 1], ['sprain', 1.2], ['strain', 1.1],
  ['fracture', 2], ['broken', 1.8], ['concussion', 1.8], ['torn', 2.2], ['tear', 2], ['rehab stalled', 1.8],
  ['struggling', 1.5], ['slumping', 1.5], ['slump', 1.4], ['cold stretch', 1.2], ['rough stretch', 1.2], ['rough outing', 1],
  ['hitless', 0.8], ['blown up', 1.3], ['shelled', 1.4], ['command issues', 1.3], ['control issues', 1.3], ['lost velocity', 1.5],
  ['velocity down', 1.4], ['strikeout concerns', 1.3], ['swing and miss concerns', 1.4], ['high strikeout rate', 1.3],
  ['poor approach', 1.2], ['defensive concerns', 1.1], ['plateaued', 1.3], ['stalled', 1.2], ['regressed', 1.5], ['regression', 1.3],
  ['stock down', 1.6], ['falling', 1.1], ['dropping', 1], ['disappointing', 1.4], ['underwhelming', 1.4], ['concern', 1],
  ['red flag', 1.8], ['question mark', 1], ['risk', 0.8], ['volatile', 1], ['inconsistent', 1.1],
  ['demoted', 1.8], ['optioned', 0.8], ['sent down', 1.2], ['released', 2.2], ['designated for assignment', 2],
  ['suspended', 2.3], ['disciplinary', 1.8], ['missed time', 1], ['delayed', 0.8], ['behind schedule', 1.1]
];

const NEGATION_PREFIXES = ['not ', 'no longer ', 'without ', 'avoided ', 'avoids ', 'cleared of ', 'free of '];
const SOURCE_WEIGHT = { 'MLB.com': 1.5, 'Baseball America': 1.5, 'FanGraphs': 1.45, 'The Athletic': 1.35, 'Sports Illustrated': 1.15, 'The Good Phight': 1.1 };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(value * 10) / 10;
const normalize = (value = '') => value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

async function readJson(url, fallback) { try { return JSON.parse(await fs.readFile(url, 'utf8')); } catch { return fallback; } }

async function loadPlayers(statRecords) {
  const localPlayers = statRecords.map(record => ({ id: record.playerId, full_name: record.player, primary_position: record.position, current_level: record.level, current_team_name: record.affiliate, mlb_pipeline_rank: null, estimated_arrival_year: null, scouting_grades: null, scouting_summary: null, stats: record.stats }));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) { console.log('Supabase secrets not present; using local stats roster for rankings.'); return localPlayers; }
  try {
    const endpoint = `${url}/rest/v1/players?select=id,full_name,primary_position,current_level,current_team_name,mlb_pipeline_rank,estimated_arrival_year,scouting_grades,scouting_summary&current_level=in.(AAA,AA,A%2B,A,Rookie)&order=full_name.asc`;
    const response = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    const enriched = await response.json();
    const statsById = new Map(localPlayers.map(player => [String(player.id), player.stats]));
    return enriched.map(player => ({ ...player, stats: statsById.get(String(player.id)) || null }));
  } catch (error) { console.warn(`Supabase enrichment failed; using local stats roster: ${error.message}`); return localPlayers; }
}

function scoutingScore(player) {
  const rank = Number(player.mlb_pipeline_rank);
  if (rank > 0) return clamp(31 - (rank - 1) * 0.72, 10, 30);
  const grades = player.scouting_grades && typeof player.scouting_grades === 'object' ? Object.values(player.scouting_grades).map(Number).filter(Number.isFinite) : [];
  return grades.length ? clamp((grades.reduce((a,b) => a+b, 0) / grades.length - 30) * 0.75, 8, 26) : 12;
}

function performanceScore(player) {
  const stats = player.stats || {};
  if (stats.type === 'hitting') {
    const ops = Number(stats.ops), walkRate = Number(stats.walkRate), strikeoutRate = Number(stats.strikeoutRate), pa = Number(stats.plateAppearances);
    if (!Number.isFinite(ops) || pa < 10) return 12.5;
    const opsPoints = clamp((ops - 0.55) / 0.45 * 16, 0, 16);
    const discipline = clamp((walkRate - 4) / 12 * 5, 0, 5) + clamp((35 - strikeoutRate) / 20 * 4, 0, 4);
    return clamp((opsPoints + discipline) * clamp(pa / 150, 0.55, 1), 4, 25);
  }
  if (stats.type === 'pitching') {
    const era = Number(stats.era), whip = Number(stats.whip), k9 = Number(stats.kPer9), bb9 = Number(stats.bbPer9), innings = Number(stats.inningsPitched);
    if (!Number.isFinite(era) || innings < 3) return 12.5;
    const runPrevention = clamp((6.5 - era) / 5 * 10, 0, 10) + clamp((1.8 - whip) / 0.9 * 6, 0, 6);
    const dominance = clamp((k9 - 4) / 10 * 6, 0, 6) + clamp((6 - bb9) / 5 * 3, 0, 3);
    return clamp((runPrevention + dominance) * clamp(innings / 40, 0.55, 1), 4, 25);
  }
  return 12.5;
}

function phraseScore(text, lexicon, direction) {
  let total = 0;
  const matched = [];
  for (const [phrase, weight] of lexicon) {
    if (!text.includes(phrase)) continue;
    const negated = NEGATION_PREFIXES.some(prefix => text.includes(`${prefix}${phrase}`));
    total += negated ? -direction * weight * 0.8 : direction * weight;
    matched.push(phrase);
  }
  return { total, matched };
}

function sentimentScore(player, articles) {
  const name = normalize(player.full_name);
  const lastName = name.split(' ').at(-1);
  let raw = 0;
  let mentions = 0;
  let positiveHits = 0;
  let negativeHits = 0;
  const reasons = [];

  for (const article of articles) {
    const title = normalize(article.title || '');
    const summary = normalize(article.summary || '');
    const text = `${title} ${summary}`;
    if (!text.includes(name) && !(lastName?.length >= 5 && text.includes(lastName))) continue;

    mentions += 1;
    const ageDays = Math.max(0, (Date.now() - new Date(article.publishedAt || 0).getTime()) / 86400000);
    const recency = Math.exp(-ageDays / 30);
    const source = SOURCE_WEIGHT[article.source] || 0.85;
    const titleBoost = title.includes(name) || (lastName?.length >= 5 && title.includes(lastName)) ? 1.25 : 1;
    const positive = phraseScore(text, POSITIVE_SENTIMENT, 1);
    const negative = phraseScore(text, NEGATIVE_SENTIMENT, -1);
    positiveHits += positive.matched.length;
    negativeHits += negative.matched.length;
    raw += (positive.total + negative.total + 0.15) * recency * source * titleBoost;
  }

  if (mentions) reasons.push(`${mentions} recent media mention${mentions === 1 ? '' : 's'}`);
  if (raw >= 4 || positiveHits >= 4) reasons.push('Strong positive prospect coverage');
  else if (raw >= 1.5) reasons.push('Positive recent coverage');
  if (raw <= -2.5 || negativeHits >= 3) reasons.push('Material negative recent coverage');
  else if (raw <= -0.8) reasons.push('Negative recent coverage');
  return { score: clamp(10 + raw, 0, 20), mentions, reasons };
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
  const proximity = LEVEL_POINTS[player.current_level || 'Rookie'] ?? 2;
  const arrival = Number(player.estimated_arrival_year);
  const currentYear = new Date().getUTCFullYear();
  const arrivalBonus = Number.isFinite(arrival) && arrival > 0 ? clamp(3 - Math.max(0, arrival - currentYear), 0, 3) : 1.2;
  return clamp(proximity + arrivalBonus, 0, 10);
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
  const components = { scouting: round(scoutingScore(player)), performance: round(performanceScore(player)), ageLevel: round(ageLevelScore(player)), sentiment: round(sentiment.score), movement: round(movement.score), risk: round(risk.score) };
  const score = round(Object.values(components).reduce((a,b) => a+b, 0));
  const prior = priorById.get(String(player.id));
  const reasons = [...sentiment.reasons, ...movement.reasons, ...risk.reasons];
  if (player.mlb_pipeline_rank) reasons.unshift(`MLB Pipeline rank #${player.mlb_pipeline_rank}`);
  if (components.performance >= 19) reasons.unshift('Strong current-season performance');
  if ((LEVEL_POINTS[player.current_level] || 0) >= 5.2) reasons.push(`Advanced to ${player.current_level}`);
  return { playerId: player.id, player: player.full_name, position: player.primary_position, affiliate: player.current_team_name, level: player.current_level, score, previousRank: prior?.rank ?? null, rank: 0, change: 0, components, mediaMentions: sentiment.mentions, reasons: reasons.slice(0, 4) };
});

records.sort((a,b) => b.score - a.score || a.player.localeCompare(b.player));
records = records.map((record, index) => { const rank = index + 1; return { ...record, rank, change: record.previousRank ? record.previousRank - rank : 0 }; });

await fs.writeFile(OUTPUT, JSON.stringify({
  updatedAt: new Date().toISOString(),
  methodology: { scouting: 30, performance: 25, ageLevel: 10, sentiment: 20, movement: 10, risk: 5, note: 'Rankings use the local daily stats roster and optionally enrich scouting fields from Supabase when secrets are available. Sentiment uses weighted baseball-specific phrases, source quality, recency, title prominence and basic negation handling.' },
  records
}, null, 2) + '\n');

console.log(`Wrote ${records.length} prospect rankings.`);
