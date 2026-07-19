import { NextRequest, NextResponse } from 'next/server';
import rankingsData from '../../../data/rankings.json';
import statsData from '../../../data/stats.json';
import injuriesData from '../../../data/injuries.json';
import promotionsData from '../../../data/promotions.json';
import newsData from '../../../data/news.json';

export const runtime = 'nodejs';

type AnyRecord = Record<string, any>;
const rankings = rankingsData.records as AnyRecord[];
const stats = statsData.records as AnyRecord[];
const injuries = injuriesData.records as AnyRecord[];
const promotions = promotionsData.records as AnyRecord[];
const news = newsData.articles as AnyRecord[];

const norm = (value = '') => value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (value = '') => norm(value).split(' ').filter(word => word.length > 2);
const has = (q: string, ...terms: string[]) => terms.some(term => norm(q).includes(norm(term)));
const pct = (value: unknown, digits = 1) => Number(value || 0).toFixed(digits);

function playerMatches(question: string) {
  const q = norm(question);
  return rankings.filter(player => {
    const full = norm(player.player);
    const parts = full.split(' ');
    return q.includes(full) || (parts.length > 1 && q.includes(parts.at(-1)!));
  });
}

function statFor(player: AnyRecord) { return stats.find(record => norm(record.player) === norm(player.player)); }
function injuryFor(player: AnyRecord) { return injuries.find(record => norm(record.player) === norm(player.player)); }
function promosFor(player: AnyRecord) { return promotions.filter(record => norm(record.player) === norm(player.player)); }
function newsFor(player: AnyRecord) {
  const full = norm(player.player);
  const last = full.split(' ').at(-1)!;
  return news.filter(article => {
    const text = norm(`${article.title || ''} ${article.summary || ''}`);
    return text.includes(full) || text.includes(last);
  });
}

function statLine(player: AnyRecord) {
  const record = statFor(player);
  const s = record?.stats;
  if (!s?.type) return 'No current statistical line is available.';
  if (s.type === 'hitting') return `${s.games ?? '—'} games, ${pct(s.average, 3)} AVG, ${pct(s.obp, 3)} OBP, ${pct(s.slg, 3)} SLG, ${pct(s.ops, 3)} OPS, ${s.homeRuns ?? 0} HR, ${s.stolenBases ?? 0} SB, ${pct(s.walkRate)}% BB and ${pct(s.strikeoutRate)}% K`;
  return `${s.games ?? '—'} games, ${s.inningsPitched ?? '—'} IP, ${pct(s.era, 2)} ERA, ${pct(s.whip, 2)} WHIP, ${pct(s.kPer9)} K/9 and ${pct(s.bbPer9)} BB/9`;
}

function performanceScore(player: AnyRecord) {
  const s = statFor(player)?.stats || {};
  if (s.type === 'hitting') return Number(s.ops || 0) * 80 + Math.max(0, 22 - Number(s.strikeoutRate || 22)) + Number(s.walkRate || 0) * .6 + Number(s.stolenBases || 0) * .15;
  if (s.type === 'pitching') return Math.max(0, 60 - Number(s.era || 8) * 7) + Number(s.kPer9 || 0) * 2.5 - Math.max(0, Number(s.bbPer9 || 3) - 3) * 4;
  return Number(player.components?.performance || 0);
}

function momentumScore(player: AnyRecord) {
  const injuryPenalty = injuryFor(player) ? 18 : 0;
  return performanceScore(player) + Number(player.change || 0) * 4 + Number(player.components?.sentiment || 0) * 1.5 + promosFor(player).length * 5 - injuryPenalty;
}

function readiness(player: AnyRecord) {
  const level: Record<string, number> = { MLB: 90, AAA: 76, AA: 57, 'A+': 38, A: 23, Rookie: 10 };
  let score = level[player.level] ?? 15;
  score += Math.min(12, Math.max(-8, performanceScore(player) / 8));
  score += Math.max(-8, Math.min(8, Number(player.change || 0) * 2));
  if (injuryFor(player)) score -= 22;
  return Math.round(Math.max(3, Math.min(94, score)));
}

function confidence(player: AnyRecord) {
  let evidence = 1;
  if (statFor(player)) evidence += 2;
  if (promosFor(player).length) evidence += 2;
  if (newsFor(player).length) evidence += Math.min(2, newsFor(player).length);
  if (injuryFor(player)) evidence += 1;
  return evidence >= 6 ? 'high' : evidence >= 3 ? 'moderate' : 'limited';
}

function strengths(player: AnyRecord) {
  const s = statFor(player)?.stats || {};
  const result: string[] = [];
  if (s.type === 'hitting') {
    if (Number(s.ops) >= .850) result.push('impactful overall production');
    if (Number(s.average) >= .290) result.push('consistent contact results');
    if (Number(s.walkRate) >= 10) result.push('strong plate discipline');
    if (Number(s.strikeoutRate) <= 17) result.push('controlled strikeout rate');
    if (Number(s.stolenBases) >= 15) result.push('baserunning impact');
    if (Number(s.homeRuns) >= 12) result.push('game power');
  } else if (s.type === 'pitching') {
    if (Number(s.kPer9) >= 10) result.push('swing-and-miss ability');
    if (Number(s.bbPer9) <= 3) result.push('usable command');
    if (Number(s.era) <= 3.5) result.push('run prevention');
    if (Number(s.whip) <= 1.2) result.push('traffic management');
  }
  if (Number(player.components?.scouting) >= 27) result.push('strong external scouting standing');
  return result.slice(0, 3);
}

function weaknesses(player: AnyRecord) {
  const s = statFor(player)?.stats || {};
  const result: string[] = [];
  if (s.type === 'hitting') {
    if (Number(s.strikeoutRate) >= 25) result.push('strikeout pressure');
    if (Number(s.walkRate) < 7) result.push('limited walk rate');
    if (Number(s.slg) < .400) result.push('developing impact');
  } else if (s.type === 'pitching') {
    if (Number(s.bbPer9) >= 4) result.push('command volatility');
    if (Number(s.whip) >= 1.45) result.push('too much traffic');
    if (Number(s.era) >= 5) result.push('inconsistent run prevention');
  }
  if (injuryFor(player)) result.push('current health uncertainty');
  return result.slice(0, 3);
}

function playerReport(player: AnyRecord, question: string) {
  const injury = injuryFor(player);
  const promos = promosFor(player);
  const articles = newsFor(player);
  const good = strengths(player);
  const concerns = weaknesses(player);
  const movement = player.change > 0 ? `up ${player.change} places` : player.change < 0 ? `down ${Math.abs(player.change)} places` : 'unchanged';
  const reasons = (player.reasons || []).filter(Boolean).slice(0, 3);
  const askingWhyNot = has(question, 'why isn', 'why is not', 'not in philadelphia', 'not in mlb', 'not called up');

  let answer = `${player.player} is currently ranked #${player.rank} by Prospect Pulse with a ${Number(player.score).toFixed(1)} score. The ranking is ${movement}, and the current statistical snapshot is ${statLine(player)}.`;
  if (good.length) answer += ` The strongest evidence in his profile is ${good.join(', ')}.`;
  if (concerns.length) answer += ` The main caution is ${concerns.join(', ')}.`;
  if (injury) answer += ` Health matters here: ${injury.timeline || injury.status || injury.injury || 'an injury is currently tracked'}.`;
  else answer += ` There is no current injury flag in the tracker.`;

  if (askingWhyNot) {
    const ready = readiness(player);
    answer += ` My free-engine readiness estimate is ${ready}/100. ${player.level === 'AAA' ? 'Being at Triple-A puts him near the final developmental step, but a call-up still depends on sustained performance, roster opportunity, and whether the organization believes the remaining weaknesses are manageable.' : `At ${player.level || 'his current level'}, the largest obstacle is simply developmental distance from the majors.`}`;
  }

  if (reasons.length) answer += ` The ranking is being driven by ${reasons.join('; ')}.`;
  if (promos.length) answer += ` The memory log includes ${promos.slice(0, 2).map(p => p.description || `${p.fromLevel || 'a lower level'} to ${p.toLevel || 'a higher level'}`).join(' and ')}.`;
  if (articles.length) answer += ` Recent tracked coverage adds ${articles.length} player-specific signal${articles.length === 1 ? '' : 's'}, but repeated coverage is not treated as independent proof.`;

  const next = concerns[0] || (player.level === 'AAA' ? 'force the issue with sustained production and wait for a roster opening' : 'translate the current strengths against more advanced competition');
  answer += ` What has to happen next: ${next}. Confidence is ${confidence(player)} because this answer is based on ${statFor(player) ? 'current statistics, ' : ''}the live ranking model${promos.length ? ', transaction history' : ''}${articles.length ? ', and tracked reporting' : ''}, while pitch-level, platoon, and multi-month trend data remain limited.`;
  return answer;
}

function comparePlayers(players: AnyRecord[]) {
  const [a, b] = players;
  const aGood = strengths(a); const bGood = strengths(b);
  const aConcern = weaknesses(a); const bConcern = weaknesses(b);
  const leader = a.score >= b.score ? a : b;
  return `${a.player} versus ${b.player} is a choice between two different evidence profiles. ${a.player} is #${a.rank} at ${a.level || 'an unknown level'} with a ${a.score.toFixed(1)} Pulse score and this line: ${statLine(a)}. ${b.player} is #${b.rank} at ${b.level || 'an unknown level'} with a ${b.score.toFixed(1)} score and this line: ${statLine(b)}.\n\n${a.player}'s clearest strengths are ${aGood.join(', ') || 'not yet clearly separated by the available data'}; the main concern is ${aConcern.join(', ') || 'the lack of deeper trend data'}. ${b.player}'s clearest strengths are ${bGood.join(', ') || 'not yet clearly separated by the available data'}; the main concern is ${bConcern.join(', ') || 'the lack of deeper trend data'}.\n\nRight now, the model gives ${leader.player} the edge because of the stronger combined scouting, performance, age-level, sentiment, movement, and risk profile. Readiness estimates are ${readiness(a)}/100 for ${a.player} and ${readiness(b)}/100 for ${b.player}. Those are transparent estimates, not organizational information. Confidence is moderate because the comparison is grounded in current structured data but does not yet have full tool grades, platoon splits, pitch shapes, or historical game-by-game trends.`;
}

function listAnswer(question: string) {
  let pool = [...rankings].filter(player => !injuryFor(player));
  let title = 'The strongest current answer is';
  if (has(question, 'pitcher', 'pitching', 'left handed pitcher', 'right handed pitcher')) pool = pool.filter(p => /P|RHP|LHP/i.test(p.position || ''));
  if (has(question, 'hitter', 'hitters', 'position player')) pool = pool.filter(p => !/P|RHP|LHP/i.test(p.position || ''));

  if (has(question, 'underrated', 'sleeper', 'breakout')) {
    title = 'The best underrated or breakout candidates are';
    pool = pool.filter(p => p.rank > 7).sort((a, b) => momentumScore(b) - momentumScore(a));
  } else if (has(question, 'closest', 'promotion', 'called up', 'reach mlb', 'ready')) {
    title = 'The best near-term promotion candidates are';
    pool.sort((a, b) => readiness(b) - readiness(a));
  } else if (has(question, 'improved', 'hottest', 'trending up', 'momentum')) {
    title = 'The strongest current momentum belongs to';
    pool.sort((a, b) => momentumScore(b) - momentumScore(a));
  } else if (has(question, 'risk', 'concern', 'trending down', 'falling')) {
    title = 'The most concerning current profiles are';
    pool = [...rankings].sort((a, b) => (injuryFor(b) ? 20 : 0) + Math.max(0, -b.change) * 5 - momentumScore(b) - ((injuryFor(a) ? 20 : 0) + Math.max(0, -a.change) * 5 - momentumScore(a)));
  } else {
    pool.sort((a, b) => a.rank - b.rank);
  }

  const selected = pool.slice(0, 5);
  if (!selected.length) return 'I do not have enough matching evidence to answer that reliably yet.';
  const lines = selected.map((p, index) => `${index + 1}. ${p.player}: #${p.rank}, ${p.level || 'level unknown'}, ${statLine(p)}. The case is built around ${strengths(p).join(', ') || 'his overall Pulse profile'}${weaknesses(p).length ? `; the caution is ${weaknesses(p).join(', ')}` : ''}.`);
  return `${title}:\n\n${lines.join('\n')}\n\nThis ordering combines present production, ranking movement, scouting score, news sentiment, level, promotion history, and health. Confidence is moderate: it is stronger than a keyword lookup, but true trend analysis will improve once the project stores dated stat snapshots rather than only the latest season line.`;
}

function resolveFollowUp(question: string, history: AnyRecord[]) {
  if (playerMatches(question).length) return question;
  const prior = [...history].reverse().find(message => message.role === 'user' && playerMatches(String(message.content || '')).length);
  if (!prior) return question;
  if (has(question, 'him', 'he', 'his', 'that player', 'why', 'what about')) return `${question} ${prior.content}`;
  return question;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawQuestion = typeof body.question === 'string' ? body.question.trim() : '';
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    if (!rawQuestion) return NextResponse.json({ error: 'Ask the Genie a question.' }, { status: 400 });
    if (rawQuestion.length > 1000) return NextResponse.json({ error: 'Please keep the question under 1,000 characters.' }, { status: 400 });

    const question = resolveFollowUp(rawQuestion, history);
    const matched = playerMatches(question);
    let answer: string;
    if (matched.length >= 2 || (matched.length === 2 && has(question, 'compare', 'versus', 'vs'))) answer = comparePlayers(matched.slice(0, 2));
    else if (matched.length === 1) answer = playerReport(matched[0], question);
    else answer = listAnswer(question);

    return NextResponse.json({ answer, evidenceUpdatedAt: new Date().toISOString(), engine: 'Prospect Genie local reasoning engine' });
  } catch (error) {
    console.error('Prospect Genie route error:', error);
    return NextResponse.json({ error: 'The Genie hit an unexpected error.' }, { status: 500 });
  }
}
