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
const words = (value = '') => new Set(normalize(value).split(' ').filter(Boolean));
const includesAny = (value: string, terms: string[]) => terms.some(term => normalize(value).includes(normalize(term)));
const format = (value: unknown, digits = 3) => Number(value || 0).toFixed(digits).replace(/^0/, '');

function findPlayers(question: string) {
  const q = normalize(question);
  const qWords = words(question);
  return rankings.filter(player => {
    const full = normalize(player.player);
    const parts = full.split(' ');
    const last = parts.at(-1) || '';
    return q.includes(full) || (last.length >= 4 && qWords.has(last));
  });
}

function statFor(player: Row) { return stats.find(row => normalize(row.player) === normalize(player.player)); }
function injuryFor(player: Row) { return injuries.find(row => normalize(row.player) === normalize(player.player)); }
function promotionsFor(player: Row) { return promotions.filter(row => normalize(row.player) === normalize(player.player)); }
function isPitcher(player: Row) { return /^(P|RHP|LHP)$/i.test(player.position || '') || statFor(player)?.stats?.type === 'pitching'; }

function statLine(player: Row) {
  const s = statFor(player)?.stats;
  if (!s) return 'No current stat line is available.';
  if (s.type === 'pitching') return `${s.inningsPitched ?? '—'} IP, ${Number(s.era ?? 0).toFixed(2)} ERA, ${Number(s.whip ?? 0).toFixed(2)} WHIP, ${Number(s.kPer9 ?? 0).toFixed(1)} K/9 and ${Number(s.bbPer9 ?? 0).toFixed(1)} BB/9`;
  return `${format(s.average)} AVG, ${format(s.obp)} OBP, ${format(s.slg)} SLG, ${format(s.ops)} OPS, ${s.homeRuns ?? 0} HR and ${s.stolenBases ?? 0} SB`;
}

function strengths(player: Row) {
  const s = statFor(player)?.stats || {};
  const output: string[] = [];
  if (s.type === 'pitching') {
    if (Number(s.kPer9) >= 10) output.push('bat-missing ability');
    if (Number(s.bbPer9) <= 3) output.push('control');
    if (Number(s.era) <= 3.5) output.push('run prevention');
  } else {
    if (Number(s.ops) >= .850) output.push('overall offensive production');
    if (Number(s.average) >= .290) output.push('contact results');
    if (Number(s.walkRate) >= 10) output.push('plate discipline');
    if (Number(s.strikeoutRate) <= 17) output.push('contact control');
    if (Number(s.homeRuns) >= 12) output.push('game power');
    if (Number(s.stolenBases) >= 15) output.push('baserunning impact');
  }
  if (Number(player.components?.scouting) >= 27) output.push('external scouting support');
  return output.slice(0, 3);
}

function concerns(player: Row) {
  const s = statFor(player)?.stats || {};
  const output: string[] = [];
  if (s.type === 'pitching') {
    if (Number(s.bbPer9) >= 4) output.push('command volatility');
    if (Number(s.whip) >= 1.45) output.push('too much traffic');
    if (Number(s.era) >= 5) output.push('uneven run prevention');
  } else {
    if (Number(s.strikeoutRate) >= 25) output.push('swing-and-miss');
    if (s.walkRate != null && Number(s.walkRate) < 7) output.push('limited walks');
    if (s.slg != null && Number(s.slg) < .400) output.push('limited current impact');
  }
  if (injuryFor(player)) output.push('health uncertainty');
  return output.slice(0, 3);
}

function performanceScore(player: Row) {
  const s = statFor(player)?.stats || {};
  if (s.type === 'pitching') return Math.max(0, 65 - Number(s.era || 8) * 7 + Number(s.kPer9 || 0) * 2.5 - Math.max(0, Number(s.bbPer9 || 3) - 3) * 5);
  if (s.type === 'hitting') return Number(s.ops || 0) * 85 + Math.max(0, 23 - Number(s.strikeoutRate || 23)) + Number(s.walkRate || 0) * .5 + Number(s.stolenBases || 0) * .15;
  return Number(player.components?.performance || 0) * 3;
}

function readiness(player: Row) {
  const levels: Record<string, number> = { MLB: 95, AAA: 78, AA: 58, 'A+': 39, A: 24, Rookie: 10 };
  let value = levels[player.level] ?? 15;
  value += Math.max(-8, Math.min(12, performanceScore(player) / 10));
  if (injuryFor(player)) value -= 20;
  return Math.round(Math.max(5, Math.min(95, value)));
}

function momentum(player: Row) {
  return performanceScore(player) + Number(player.change || 0) * 5 + promotionsFor(player).length * 4 - (injuryFor(player) ? 18 : 0);
}

function playerAnswer(player: Row, question: string) {
  const good = strengths(player);
  const bad = concerns(player);
  const injury = injuryFor(player);
  const asksReadiness = includesAny(question, ['ready', 'call up', 'called up', 'philadelphia', 'mlb', 'eta']);
  const asksRank = includesAny(question, ['rank', 'ranking', 'why']);
  let answer = `${player.player} is currently #${player.rank} in Prospect Pulse at ${player.level || 'an unknown level'}. His current line is ${statLine(player)}.`;
  if (good.length) answer += ` The best evidence in the profile is ${good.join(', ')}.`;
  if (bad.length) answer += ` The main concern is ${bad.join(', ')}.`;
  if (injury) answer += ` He is also carrying an active health flag: ${injury.timeline || injury.status || injury.injury}.`;
  if (asksReadiness) answer += ` The model's current MLB-readiness estimate is ${readiness(player)}/100. That reflects level, production and health—not inside information from the Phillies.`;
  if (asksRank && player.reasons?.length) answer += ` The ranking is primarily supported by ${player.reasons.slice(0, 3).join('; ')}.`;
  answer += ` The next thing to watch is ${bad[0] || (player.level === 'AAA' ? 'whether sustained performance creates a roster opportunity' : 'how the production translates against more advanced competition')}.`;
  return answer;
}

function compareAnswer(players: Row[]) {
  const [a, b] = players;
  const winner = Number(a.score) >= Number(b.score) ? a : b;
  return `${a.player} is #${a.rank} at ${a.level || 'an unknown level'} with ${statLine(a)}. ${b.player} is #${b.rank} at ${b.level || 'an unknown level'} with ${statLine(b)}.\n\n${a.player}'s best traits in the available data are ${strengths(a).join(', ') || 'not clearly separated yet'}, while the caution is ${concerns(a).join(', ') || 'limited supporting detail'}. ${b.player}'s best traits are ${strengths(b).join(', ') || 'not clearly separated yet'}, while the caution is ${concerns(b).join(', ') || 'limited supporting detail'}.\n\nRight now I would lean ${winner.player}, based on the stronger combined ranking, production, level and risk profile. Readiness estimates are ${readiness(a)}/100 and ${readiness(b)}/100, respectively.`;
}

function rankedList(question: string) {
  let pool = [...rankings];
  if (includesAny(question, ['pitcher', 'pitching'])) pool = pool.filter(isPitcher);
  if (includesAny(question, ['hitter', 'position player'])) pool = pool.filter(player => !isPitcher(player));

  let intro = 'The strongest current profiles are';
  if (includesAny(question, ['underrated', 'sleeper', 'breakout'])) {
    intro = 'My best underrated candidates right now are';
    pool = pool.filter(player => player.rank > 7 && !injuryFor(player)).sort((a, b) => momentum(b) - momentum(a));
  } else if (includesAny(question, ['ready', 'closest', 'call up', 'called up', 'debut', 'reach mlb'])) {
    intro = 'The closest current MLB candidates are';
    pool = pool.filter(player => !injuryFor(player)).sort((a, b) => readiness(b) - readiness(a));
  } else if (includesAny(question, ['improved', 'hot', 'hottest', 'momentum', 'trending up'])) {
    intro = 'The strongest current momentum belongs to';
    pool = pool.filter(player => !injuryFor(player)).sort((a, b) => momentum(b) - momentum(a));
  } else if (includesAny(question, ['risk', 'concern', 'cold', 'falling', 'trending down'])) {
    intro = 'The profiles carrying the most concern are';
    pool.sort((a, b) => (injuryFor(b) ? 25 : 0) + Math.max(0, -Number(b.change || 0)) * 5 - momentum(b) - ((injuryFor(a) ? 25 : 0) + Math.max(0, -Number(a.change || 0)) * 5 - momentum(a)));
  } else {
    pool.sort((a, b) => a.rank - b.rank);
  }

  const chosen = pool.slice(0, 5);
  if (!chosen.length) return 'I do not have enough matching data to answer that yet.';
  return `${intro}:\n\n${chosen.map((player, index) => `${index + 1}. ${player.player} — #${player.rank}, ${player.level || 'level unknown'}, ${statLine(player)}. Best signal: ${strengths(player)[0] || 'overall model strength'}${concerns(player)[0] ? `; concern: ${concerns(player)[0]}` : ''}.`).join('\n')}\n\nThis is a model ranking built from the current data snapshot, not an organizational depth chart.`;
}

function explicitFollowUp(question: string) {
  const q = words(question);
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
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    if (!question) return NextResponse.json({ error: 'Ask the Genie a question.' }, { status: 400 });

    let matched = findPlayers(question);
    if (!matched.length && explicitFollowUp(question)) {
      const prior = lastMentionedPlayer(history);
      if (prior) matched = [prior];
    }

    let answer: string;
    if (matched.length >= 2) answer = compareAnswer(matched.slice(0, 2));
    else if (matched.length === 1) answer = playerAnswer(matched[0], question);
    else answer = rankedList(question);

    return NextResponse.json(
      { answer, matchedPlayers: matched.map(player => player.player), engine: 'Prospect Genie rules engine v2', requestQuestion: question },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('Prospect Genie route error:', error);
    return NextResponse.json({ error: 'The Genie hit an unexpected error.' }, { status: 500 });
  }
}
