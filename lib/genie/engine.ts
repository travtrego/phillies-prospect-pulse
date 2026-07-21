import statsData from '../../data/stats.json';
import injuriesData from '../../data/injuries.json';
import promotionsData from '../../data/promotions.json';
import { enrichRankings } from '../ranking/intelligence';
import type { GenieIntent, GenieMetric, GeniePlan, GenieResult, PlayerEvidence } from './types';
import { decisionMetric, projectPlayer } from './projections';

const rankings = enrichRankings() as Record<string, any>[];
const stats = statsData.records as Record<string, any>[];
const injuries = injuriesData.records as Record<string, any>[];
const promotions = promotionsData.records as Record<string, any>[];

const normalize = (value = '') => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const clamp = (value:number, min=0, max=100) => Math.max(min, Math.min(max, value));
const finite = (value:unknown, fallback=0) => { const number=Number(value); return Number.isFinite(number)?number:fallback; };

function statFor(player: Record<string, any>) { return stats.find(row => normalize(row.player) === normalize(player.player)); }
function injuryFor(player: Record<string, any>) { return injuries.find(row => normalize(row.player) === normalize(player.player)); }
function promotionsFor(player: Record<string, any>) { return promotions.filter(row => normalize(row.player) === normalize(player.player)); }
function levelFor(player: Record<string, any>) { return statFor(player)?.level || player.level || null; }
function ageFor(player: Record<string, any>) { return finite(statFor(player)?.currentAge || player.age, 0) || null; }
function countryFor(player: Record<string, any>) { return statFor(player)?.birthCountry || player.birthCountry || null; }
function isPitcher(player: Record<string, any>) { return /^(P|RHP|LHP|SP|RP)$/i.test(player.position || '') || statFor(player)?.stats?.type === 'pitching'; }
function matchesPosition(player: Record<string, any>, wanted: string) {
  const pos = String(player.position || '').toUpperCase();
  if (wanted === 'OF') return ['CF', 'LF', 'RF', 'OF'].includes(pos);
  if (wanted === 'IF') return ['SS', '2B', '3B', '1B', 'IF'].includes(pos);
  return pos === wanted;
}

function performance(player: Record<string, any>) {
  const s = statFor(player)?.stats || {};
  if (s.type === 'pitching') return clamp(70 - finite(s.era, 7) * 7 + finite(s.kPer9) * 3 - Math.max(0, finite(s.bbPer9, 3) - 3) * 6);
  if (s.type === 'hitting') return clamp(finite(s.ops) * 85 + Math.max(0, 24 - finite(s.strikeoutRate, 24)) + finite(s.walkRate) * .7 + finite(s.stolenBases) * .2);
  return clamp(finite(player.components?.performance) * 3.3);
}

function scoreSet(player: Record<string, any>): Record<GenieMetric, number> {
  const s = statFor(player)?.stats || {};
  const scouting = clamp(finite(player.components?.scouting) * 3.3);
  const ageLevel = clamp(finite(player.components?.ageLevel) * 10);
  const healthPenalty = injuryFor(player) ? 25 : 0;
  const promotionBoost = promotionsFor(player).length * 4;
  const perf = performance(player);
  const levelBase: Record<string, number> = { MLB:95, AAA:80, AA:60, 'A+':42, A:27, Rookie:12 };
  const readiness = clamp((levelBase[levelFor(player) || ''] || 15) + perf * .12 - healthPenalty);
  const momentum = clamp(perf + finite(player.change) * 8 + promotionBoost - healthPenalty);
  const ceiling = clamp(scouting * .6 + ageLevel * .25 + perf * .15 - healthPenalty * .2);
  const floor = clamp(readiness * .45 + perf * .35 + scouting * .2 - healthPenalty * .5);
  const power = s.type === 'hitting' ? clamp(finite(s.slg) * 120 + finite(s.homeRuns) * 1.6) : 0;
  const speed = s.type === 'hitting' ? clamp(finite(s.stolenBases) * 4 + Math.max(0, 20 - finite(s.caughtStealing) * 2)) : 0;
  const contact = s.type === 'hitting' ? clamp(finite(s.average) * 250 + Math.max(0, 25 - finite(s.strikeoutRate, 25))) : 0;
  const discipline = s.type === 'hitting' ? clamp(finite(s.walkRate) * 6 + Math.max(0, 22 - finite(s.strikeoutRate, 22))) : 0;
  const strikeouts = s.type === 'pitching' ? clamp(finite(s.kPer9) * 8) : 0;
  const command = s.type === 'pitching' ? clamp(100 - finite(s.bbPer9, 6) * 14) : 0;
  const risk = clamp(100 - floor + healthPenalty);
  const overall = clamp(finite(player.intelligence?.modelScore, finite(player.score)));
  return { overall, ceiling, floor, performance:perf, momentum, readiness, power, speed, contact, discipline, strikeouts, command, risk };
}

function strengths(_player: Record<string, any>, scores: Record<GenieMetric, number>) {
  return Object.entries(scores).filter(([metric,value]) => !['overall','risk','floor'].includes(metric) && value>0).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([metric])=>metric.replace(/([A-Z])/g,' $1').toLowerCase());
}

function concerns(player: Record<string, any>, scores: Record<GenieMetric, number>) {
  const output:string[]=[];
  if (injuryFor(player)) output.push('health uncertainty');
  if (scores.risk >= 65) output.push('overall risk');
  const s=statFor(player)?.stats||{};
  if (s.type==='hitting'&&finite(s.strikeoutRate)>=25) output.push('swing-and-miss');
  if (s.type==='pitching'&&finite(s.bbPer9)>=4) output.push('command');
  return [...new Set(output)].slice(0,3);
}

function buildPlan(intent: GenieIntent): GeniePlan {
  const steps = [{ tool:'searchPlayers', description:'Find players matching the named players and filters.' }];
  if (intent.asksBiography || intent.filters.international || intent.filters.ageUnder || intent.filters.ageOver) steps.push({ tool:'getPlayerBio', description:'Load verified age, country and handedness fields.' });
  if (intent.asksStats || intent.metric !== 'overall') steps.push({ tool:'getCurrentStats', description:'Load the current statistical record.' });
  if (intent.task === 'injury_report' || intent.filters.healthyOnly || intent.filters.injuredOnly || ['risk','floor','readiness'].includes(intent.metric)) steps.push({ tool:'getInjuries', description:'Check current health information.' });
  if (intent.task === 'promotion_report' || ['momentum','readiness'].includes(intent.metric)) steps.push({ tool:'getPromotions', description:'Check recent affiliate movement.' });
  steps.push({ tool:'scorePlayers', description:`Score the matching players for ${intent.metric}.` });
  if (decisionMetric(intent.rawQuestion) || intent.asksProjection) steps.push({ tool:'projectPlayerOutcomes', description:'Estimate promotion, breakout, MLB, trade and protection outcomes.' });
  if (decisionMetric(intent.rawQuestion)) steps.push({ tool:'makeFrontOfficeRecommendation', description:'Balance upside, floor, proximity, health and volatility into a recommendation.' });
  steps.push({ tool:'writeAnswer', description:'Explain the result using the strongest evidence and known limitations.' });
  return { intent, steps };
}

function applyFilters(intent: GenieIntent) {
  return rankings.filter(player => {
    const level = levelFor(player);
    const age = ageFor(player);
    const country = normalize(countryFor(player) || '');
    if (intent.players.length && !intent.players.some(name => normalize(name) === normalize(player.player))) return false;
    if (intent.filters.level && level !== intent.filters.level) return false;
    if (intent.filters.positionType === 'pitcher' && !isPitcher(player)) return false;
    if (intent.filters.positionType === 'hitter' && isPitcher(player)) return false;
    if (intent.filters.position && !matchesPosition(player, intent.filters.position)) return false;
    if (intent.filters.international && (!country || ['usa','united states','united states of america'].includes(country))) return false;
    if (intent.filters.healthyOnly && injuryFor(player)) return false;
    if (intent.filters.injuredOnly && !injuryFor(player)) return false;
    if (intent.filters.ageUnder && (!age || age >= intent.filters.ageUnder)) return false;
    if (intent.filters.ageOver && (!age || age <= intent.filters.ageOver)) return false;
    if (intent.filters.etaBy && finite(player.eta || player.estimated_arrival_year, 9999) > intent.filters.etaBy) return false;
    return true;
  });
}

const FACTUAL_REPORT_TASKS = ['promotion_report', 'injury_report', 'system_summary'];

export function runEngine(intent: GenieIntent): GenieResult {
  const plan = buildPlan(intent);
  const selectedDecisionMetric = FACTUAL_REPORT_TASKS.includes(intent.task) ? null : decisionMetric(intent.rawQuestion);
  const pool = applyFilters(intent);
  const evidence: PlayerEvidence[] = pool.map(player => {
    const scores = scoreSet(player);
    const base={ player, stat:statFor(player), injury:injuryFor(player), promotions:promotionsFor(player), scores, strengths:strengths(player,scores), concerns:concerns(player,scores) };
    return { ...base, projections:projectPlayer(base) };
  });
  if(selectedDecisionMetric){
    evidence.sort((a,b)=>finite(b.projections?.[selectedDecisionMetric])-finite(a.projections?.[selectedDecisionMetric]));
  }else{
    evidence.sort((a,b)=>finite(b.scores[intent.metric])-finite(a.scores[intent.metric]));
  }
  const selectionLimit = intent.task === 'player_profile'
    ? 1
    : intent.task === 'compare_players'
      ? Math.max(intent.players.length, intent.limit, 2)
      : intent.limit;
  const selected = evidence.slice(0, selectionLimit);
  const limitations:string[]=[];
  if (intent.filters.international && selected.some(item=>!countryFor(item.player))) limitations.push('Some birth-country fields are missing.');
  if (selected.some(item=>!item.stat)) limitations.push('At least one player does not have a current stat line.');
  if (!selected.length) limitations.push('No players matched every requested filter.');
  if(selectedDecisionMetric)limitations.push('Projection scores are model estimates, not guarantees or externally sourced forecasts.');
  const confidence = !selected.length ? 'low' : limitations.length ? 'moderate' : 'high';
  return { intent, plan, evidence:selected, decisionMetric:selectedDecisionMetric, confidence, limitations };
}
