import type { GenieFilters, GenieIntent, GenieMetric, GenieTask } from './types';

const normalize = (value = '') => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9+ ]/g, ' ').replace(/\s+/g, ' ').trim();
const hasAny = (value: string, terms: string[]) => terms.some(term => normalize(value).includes(normalize(term)));

function parseLimit(question: string) {
  const q = normalize(question);
  const explicit = q.match(/\b(?:top|best|list|give me|show me)\s+(\d{1,2})\b/) ?? q.match(/\b(\d{1,2})\s+(?:top|best)\b/);
  if (explicit) return Math.max(1, Math.min(10, Number(explicit[1])));
  const numbers: Record<string, number> = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 };
  for (const [word, value] of Object.entries(numbers)) {
    if (new RegExp(`\\b(?:top|best|list|give me|show me)\\s+${word}\\b`).test(q) || new RegExp(`\\b${word}\\s+(?:top|best)\\b`).test(q)) return value;
  }
  return hasAny(q, ['who is', "who s", 'which prospect', 'best prospect']) ? 1 : 5;
}

function parseMetric(question: string): GenieMetric {
  if (hasAny(question, ['ceiling', 'upside', 'star potential', 'highest potential'])) return 'ceiling';
  if (hasAny(question, ['floor', 'safest', 'least risky'])) return 'floor';
  if (hasAny(question, ['ready', 'closest', 'call up', 'called up', 'mlb soon', 'debut'])) return 'readiness';
  if (hasAny(question, ['hot', 'hottest', 'momentum', 'trending up', 'improved', 'breakout'])) return 'momentum';
  if (hasAny(question, ['power', 'home run', 'slugger', 'slugging'])) return 'power';
  if (hasAny(question, ['speed', 'fastest', 'stolen base', 'runner'])) return 'speed';
  if (hasAny(question, ['contact', 'batting average', 'hit tool'])) return 'contact';
  if (hasAny(question, ['discipline', 'walk rate', 'plate approach', 'strike zone'])) return 'discipline';
  if (hasAny(question, ['strikeout pitcher', 'miss bats', 'k rate', 'strikeouts'])) return 'strikeouts';
  if (hasAny(question, ['command', 'control', 'walks allowed'])) return 'command';
  if (hasAny(question, ['risk', 'concern', 'falling', 'trending down', 'cold'])) return 'risk';
  if (hasAny(question, ['performance', 'best season', 'producing'])) return 'performance';
  return 'overall';
}

function parseTask(question: string, playerCount: number): GenieTask {
  if (hasAny(question, ['injury', 'injured', 'health', 'on the il', 'injured list'])) return playerCount ? 'player_profile' : 'injury_report';
  if (hasAny(question, ['promoted', 'promotion', 'moved up', 'transaction'])) return playerCount ? 'player_profile' : 'promotion_report';
  if (playerCount >= 2 || hasAny(question, ['compare', 'versus', ' vs ', 'better than'])) return 'compare_players';
  if (playerCount === 1) return 'player_profile';
  if (hasAny(question, ['system', 'farm system', 'overall state', 'summary'])) return 'system_summary';
  if (hasAny(question, ['trend', 'hot', 'hottest', 'improved', 'falling', 'momentum'])) return 'trend_players';
  return 'rank_players';
}

export function parseIntent(question: string, matchedPlayers: string[]): GenieIntent {
  const q = normalize(question);
  const filters: GenieFilters = {};
  if (hasAny(q, ['international', 'foreign born', 'outside the united states'])) filters.international = true;
  if (hasAny(q, ['pitcher', 'pitching'])) filters.positionType = 'pitcher';
  if (hasAny(q, ['hitter', 'position player', 'bat'])) filters.positionType = 'hitter';
  if (hasAny(q, ['triple a', 'triple-a', 'aaa'])) filters.level = 'AAA';
  else if (hasAny(q, ['double a', 'double-a', 'aa'])) filters.level = 'AA';
  else if (hasAny(q, ['high a', 'high-a', 'a+'])) filters.level = 'A+';
  else if (hasAny(q, ['single a', 'single-a'])) filters.level = 'A';
  if (hasAny(q, ['healthy', 'not injured'])) filters.healthyOnly = true;
  if (hasAny(q, ['injured', 'on the il', 'injury list'])) filters.injuredOnly = true;
  const under = q.match(/under\s+(\d{2})/); if (under) filters.ageUnder = Number(under[1]);
  const over = q.match(/(?:over|older than)\s+(\d{2})/); if (over) filters.ageOver = Number(over[1]);
  const eta = q.match(/(?:by|before|through)\s+(20\d{2})/); if (eta) filters.etaBy = Number(eta[1]);

  return {
    task: parseTask(question, matchedPlayers.length),
    metric: parseMetric(question),
    players: matchedPlayers,
    filters,
    limit: parseLimit(question),
    asksWhy: hasAny(q, ['why', 'explain', 'reason', 'case for', 'case against']),
    asksBiography: hasAny(q, ['age', 'old', 'born', 'country', 'height', 'weight', 'bats', 'throws', 'bio']),
    asksStats: hasAny(q, ['stats', 'numbers', 'line', 'hitting', 'pitching', 'ops', 'era']),
    asksProjection: hasAny(q, ['project', 'projection', 'future', 'ceiling', 'floor', 'eta', 'ready']),
    asksRecent: hasAny(q, ['recent', 'latest', 'today', 'this week', 'right now', 'currently']),
    rawQuestion: question
  };
}
