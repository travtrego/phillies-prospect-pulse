import { NextRequest, NextResponse } from 'next/server';
import rankingsData from '../../../data/rankings.json';
import statsData from '../../../data/stats.json';
import injuriesData from '../../../data/injuries.json';
import promotionsData from '../../../data/promotions.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = Record<string, any>;
const rankings = rankingsData.records as Row[];
const stats = statsData.records as Row[];
const injuries = injuriesData.records as Row[];
const promotions = promotionsData.records as Row[];

const normalize = (value = '') => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const wordSet = (value = '') => new Set(normalize(value).split(' ').filter(Boolean));
const includesAny = (value: string, terms: string[]) => terms.some(term => normalize(value).includes(normalize(term)));
const rate = (value: unknown, digits = 3) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits).replace(/^0/, '') : '—';
};

function statFor(player: Row) { return stats.find(row => normalize(row.player) === normalize(player.player)); }
function injuryFor(player: Row) { return injuries.find(row => normalize(row.player) === normalize(player.player)); }
function promotionsFor(player: Row) { return promotions.filter(row => normalize(row.player) === normalize(player.player)); }
function levelFor(player: Row) { return statFor(player)?.level || player.level || 'level unavailable'; }
function isPitcher(player: Row) { return /^(P|RHP|LHP)$/i.test(player.position || '') || statFor(player)?.stats?.type === 'pitching'; }
function ageFor(player: Row) { return Number(statFor(player)?.currentAge || player.age || 0) || null; }
function countryFor(player: Row) { return statFor(player)?.birthCountry || player.birthCountry || null; }

function findPlayers(question: string) {
  const q = normalize(question);
  const qWords = wordSet(question);
  return rankings.filter(player => {
    const full = normalize(player.player);
    const last = full.split(' ').at(-1) || '';
    return q.includes(full) || (last.length >= 4 && qWords.has(last));
  });
}

function requestedCount(question: string) {
  const q = normalize(question);
  const digit = q.match(/\b(?:top|best|list)?\s*(\d{1,2})\b/);
  if (digit) return Math.max(1, Math.min(10, Number(digit[1])));
  const numbers: Record<string, number> = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 };
  for (const [word, value] of Object.entries(numbers)) if (new RegExp(`\\b${word}\\b`).test(q)) return value;
  return includesAny(question, ['who is', "who's", 'which prospect', 'best prospect']) ? 1 : 5;
}

function statLine(player: Row) {
  const s = statFor(player)?.stats;
  if (!s?.type) return 'no current season line';
  if (s.type === 'pitching') return `${s.inningsPitched ?? '—'} IP, ${Number(s.era ?? 0).toFixed(2)} ERA, ${Number(s.whip ?? 0).toFixed(2)} WHIP, ${Number(s.kPer9 ?? 0).toFixed(1)} K/9 and ${Number(s.bbPer9 ?? 0).toFixed(1)} BB/9`;
  return `${rate(s.average)} AVG, ${rate(s.obp)} OBP, ${rate(s.slg)} SLG, ${rate(s.ops)} OPS, ${s.homeRuns ?? 0} HR and ${s.stolenBases ?? 0} SB`;
}

function strengths(player: Row) {
  const s = statFor(player)?.stats || {};
  const output: string[] = [];
  if (s.type === 'pitching') {
    if (Number(s.kPer9) >= 10) output.push('misses bats');
    if (Number(s.bbPer9) > 0 && Number(s.bbPer9) <= 3) output.push('limits walks');
    if (Number(s.era) > 0 && Number(s.era) <= 3.5) output.push('prevents runs');
    if (Number(s.whip) > 0 && Number(s.whip) <= 1.2) output.push('limits traffic');
  } else if (s.type === 'hitting') {
    if (Number(s.ops) >= .850) output.push('produces at a high offensive level');
    if (Number(s.average) >= .290) output.push('gets consistent hit results');
    if (Number(s.walkRate) >= 10) output.push('controls the strike zone');
    if (Number(s.strikeoutRate) > 0 && Number(s.strikeoutRate) <= 17) output.push('keeps strikeouts under control');
    if (Number(s.homeRuns) >= 12) output.push('shows game power');
    if (Number(s.stolenBases) >= 15) output.push('adds value on the bases');
  }
  if (!output.length && Number(player.components?.scouting) >= 27) output.push('has strong external scouting support');
  return output.slice(0, 2);
}

function concerns(player: Row) {
  const s = statFor(player)?.stats || {};
  const output: string[] = [];
  if (s.type === 'pitching') {
    if (Number(s.bbPer9) >= 4) output.push('command');
    if (Number(s.whip) >= 1.45) output.push('baserunner traffic');
    if (Number(s.era) >= 5) output.push('run prevention');
  } else if (s.type === 'hitting') {
    if (Number(s.strikeoutRate) >= 25) output.push('swing-and-miss');
    if (s.walkRate != null && Number(s.walkRate) < 7) output.push('a low walk rate');
    if (s.slg != null && Number(s.slg) < .400) output.push('limited impact power');
  }
  if (injuryFor(player)) output.push('health');
  return output.slice(0, 2);
}

function performanceScore(player: Row) {
  const s = statFor(player)?.stats || {};
  if (s.type === 'pitching') return Math.max(0, 65 - Number(s.era || 8) * 7 + Number(s.kPer9 || 0) * 2.5 - Math.max(0, Number(s.bbPer9 || 3) - 3) * 5);
  if (s.type === 'hitting') return Number(s.ops || 0) * 85 + Math.max(0, 23 - Number(s.strikeoutRate || 23)) + Number(s.walkRate || 0) * .5 + Number(s.stolenBases || 0) * .15;
  return Number(player.components?.performance || 0) * 3;
}

function readiness(player: Row) {
  const levels: Record<string, number> = { MLB:95, AAA:78, AA:58, 'A+':39, A:24, Rookie:10 };
  let value = levels[levelFor(player)] ?? 15;
  value += Math.max(-8, Math.min(12, performanceScore(player) / 10));
  if (injuryFor(player)) value -= 20;
  return Math.round(Math.max(5, Math.min(95, value)));
}

function momentum(player: Row) {
  return performanceScore(player) + Number(player.change || 0) * 5 + promotionsFor(player).length * 4 - (injuryFor(player) ? 18 : 0);
}

function ceilingScore(player: Row) {
  return Number(player.components?.scouting || 0) * 3 + Number(player.components?.ageLevel || 0) * 2 + Number(player.score || 0) - (injuryFor(player) ? 8 : 0);
}

function applyFilters(question: string, input: Row[]) {
  let pool = [...input];
  if (includesAny(question, ['international', 'foreign born', 'foreign-born', 'outside the united states'])) {
    pool = pool.filter(player => {
      const country = normalize(countryFor(player) || '');
      return country && !['usa', 'united states', 'united states of america'].includes(country);
    });
  }
  if (includesAny(question, ['pitcher', 'pitching'])) pool = pool.filter(isPitcher);
  if (includesAny(question, ['hitter', 'position player'])) pool = pool.filter(player => !isPitcher(player));
  if (includesAny(question, ['triple a', 'triple-a', 'aaa'])) pool = pool.filter(player => levelFor(player) === 'AAA');
  else if (includesAny(question, ['double a', 'double-a', 'aa'])) pool = pool.filter(player => levelFor(player) === 'AA');
  else if (includesAny(question, ['high a', 'high-a', 'a+'])) pool = pool.filter(player => levelFor(player) === 'A+');
  else if (includesAny(question, ['single a', 'single-a'])) pool = pool.filter(player => levelFor(player) === 'A');

  const under = normalize(question).match(/under\s+(\d{2})/);
  if (under) pool = pool.filter(player => ageFor(player) !== null && ageFor(player)! < Number(under[1]));
  const over = normalize(question).match(/(?:over|older than)\s+(\d{2})/);
  if (over) pool = pool.filter(player => ageFor(player) !== null && ageFor(player)! > Number(over[1]));
  if (includesAny(question, ['healthy', 'not injured'])) pool = pool.filter(player => !injuryFor(player));
  if (includesAny(question, ['injured', 'injury', 'il'])) pool = pool.filter(player => Boolean(injuryFor(player)));
  return pool;
}

function intentSort(question: string, pool: Row[]) {
  let intro = 'The top current Prospect Pulse profiles are';
  if (includesAny(question, ['underrated', 'sleeper', 'breakout'])) {
    intro = 'The best underrated candidates right now are';
    return { intro, pool: pool.filter(player => player.rank > 7).sort((a, b) => momentum(b) - momentum(a)) };
  }
  if (includesAny(question, ['ready', 'closest', 'call up', 'called up', 'debut', 'reach mlb'])) {
    intro = 'The players closest to helping in Philadelphia are';
    return { intro, pool: pool.sort((a, b) => readiness(b) - readiness(a)) };
  }
  if (includesAny(question, ['improved', 'hot', 'hottest', 'momentum', 'trending up'])) {
    intro = 'The strongest current momentum belongs to';
    return { intro, pool: pool.sort((a, b) => momentum(b) - momentum(a)) };
  }
  if (includesAny(question, ['ceiling', 'upside', 'highest potential', 'star potential'])) {
    intro = 'The highest-upside profiles in the current model are';
    return { intro, pool: pool.sort((a, b) => ceilingScore(b) - ceilingScore(a)) };
  }
  if (includesAny(question, ['power', 'home run', 'slugger'])) {
    intro = 'The strongest current power profiles are';
    return { intro, pool: pool.filter(player => !isPitcher(player)).sort((a, b) => Number(statFor(b)?.stats?.homeRuns || 0) - Number(statFor(a)?.stats?.homeRuns || 0)) };
  }
  if (includesAny(question, ['speed', 'fastest', 'stolen base'])) {
    intro = 'The strongest current speed profiles are';
    return { intro, pool: pool.filter(player => !isPitcher(player)).sort((a, b) => Number(statFor(b)?.stats?.stolenBases || 0) - Number(statFor(a)?.stats?.stolenBases || 0)) };
  }
  if (includesAny(question, ['strikeout', 'miss bats', 'k rate'])) {
    intro = 'The strongest current strikeout profiles are';
    return { intro, pool: pool.filter(isPitcher).sort((a, b) => Number(statFor(b)?.stats?.kPer9 || 0) - Number(statFor(a)?.stats?.kPer9 || 0)) };
  }
  if (includesAny(question, ['risk', 'concern', 'cold', 'falling', 'trending down'])) {
    intro = 'The profiles carrying the most concern are';
    return { intro, pool: pool.sort((a, b) => ((injuryFor(b) ? 25 : 0) - momentum(b)) - ((injuryFor(a) ? 25 : 0) - momentum(a))) };
  }
  return { intro, pool: pool.sort((a, b) => Number(a.rank || 999) - Number(b.rank || 999)) };
}

function playerAnswer(player: Row, question: string) {
  const record = statFor(player);
  if (includesAny(question, ['age', 'old', 'born', 'country', 'international', 'height', 'weight', 'bats', 'throws'])) {
    const facts = [record?.currentAge != null ? `age ${record.currentAge}` : null, record?.birthCountry ? `from ${record.birthCountry}` : null, record?.height || null, record?.weight ? `${record.weight} lb` : null, record?.bats ? `bats ${record.bats}` : null, record?.throws ? `throws ${record.throws}` : null].filter(Boolean).join(', ');
    return `${player.player} is ${facts || 'missing verified biographical details in the current feed'}. He is currently at ${levelFor(player)} with ${record?.affiliate || 'an affiliate not listed'}.`;
  }

  const good = strengths(player);
  const bad = concerns(player);
  let answer = `${player.player} is ranked #${player.rank} by Prospect Pulse and is currently at ${levelFor(player)}. His season line is ${statLine(player)}.`;
  if (good.length) answer += ` The positive case is that he ${good.join(' and ')}.`;
  if (bad.length) answer += ` The main question is ${bad.join(' and ')}.`;
  if (includesAny(question, ['ready', 'call up', 'called up', 'philadelphia', 'mlb', 'eta'])) answer += ` His current MLB-readiness estimate is ${readiness(player)}/100.`;
  if (includesAny(question, ['rank', 'ranking', 'why']) && player.reasons?.length) answer += ` The ranking is mainly supported by ${player.reasons.slice(0, 2).join('; ')}.`;
  return answer;
}

function compareAnswer(players: Row[]) {
  const [a, b] = players;
  const winner = Number(a.score) >= Number(b.score) ? a : b;
  return `${a.player} is #${a.rank} at ${levelFor(a)} with ${statLine(a)}. ${b.player} is #${b.rank} at ${levelFor(b)} with ${statLine(b)}.\n\nI would currently lean ${winner.player}. The model sees the stronger combined ranking, production, level and risk profile there. ${a.player}'s main concern is ${concerns(a)[0] || 'the limited depth of the current data'}, while ${b.player}'s is ${concerns(b)[0] || 'the limited depth of the current data'}.`;
}

function listAnswer(question: string) {
  const count = requestedCount(question);
  const filtered = applyFilters(question, rankings);
  if (!filtered.length) {
    if (includesAny(question, ['international', 'foreign born', 'foreign-born'])) return 'I cannot reliably list international prospects yet because the current player data does not contain enough verified birth-country information. The bio enrichment job needs to finish before I should guess.';
    return 'I could not find any players matching all of those filters in the current data.';
  }
  const { intro, pool } = intentSort(question, filtered);
  const chosen = pool.slice(0, count);
  return `${intro}:\n\n${chosen.map((player, index) => {
    const country = countryFor(player);
    const age = ageFor(player);
    const context = [country, age ? `age ${age}` : null, levelFor(player)].filter(Boolean).join(' · ');
    const positive = strengths(player)[0];
    const caution = concerns(player)[0];
    return `${index + 1}. ${player.player} — #${player.rank}${context ? ` · ${context}` : ''}. ${statLine(player)}.${positive ? ` He ${positive}.` : ''}${caution ? ` The main concern is ${caution}.` : ''}`;
  }).join('\n')}\n\nThis answer uses the current Prospect Pulse data snapshot and only applies filters supported by verified fields.`;
}

function explicitFollowUp(question: string) {
  const q = wordSet(question);
  return ['he', 'him', 'his'].some(word => q.has(word)) || includesAny(question, ['that player', 'the first one', 'the second one', 'compare him']);
}

function lastMentionedPlayer(history: Row[]) {
  for (const message of [...history].reverse()) {
    const matches = findPlayers(String(message.content || ''));
    if (matches.length) return matches[0];
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const question = typeof body.question === 'string' ? body.question.trim() : '';
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
    if (!question) return NextResponse.json({ error: 'Ask the Genie a question.' }, { status: 400 });
    if (question.length > 1000) return NextResponse.json({ error: 'Please keep the question under 1,000 characters.' }, { status: 400 });

    let matched = findPlayers(question);
    if (!matched.length && explicitFollowUp(question)) {
      const prior = lastMentionedPlayer(history);
      if (prior) matched = [prior];
    }

    const answer = matched.length >= 2 ? compareAnswer(matched.slice(0, 2)) : matched.length === 1 ? playerAnswer(matched[0], question) : listAnswer(question);

    return NextResponse.json(
      { answer, matchedPlayers: matched.map(player => player.player), engine: 'Prospect Genie rules engine v3', requestQuestion: question },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('Prospect Genie route error:', error);
    return NextResponse.json({ error: 'The Genie hit an unexpected error.' }, { status: 500 });
  }
}
