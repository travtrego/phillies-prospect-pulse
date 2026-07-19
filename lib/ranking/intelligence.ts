import rankingsData from '../../data/rankings.json';
import statsData from '../../data/stats.json';
import externalData from '../../data/external-rankings.json';
import { normalizeText } from '../genie/shared';
import { consensusScore, evaluateRanking, RANKING_MODEL_VERSION } from './model';

type Row=Record<string,any>;
type ExternalRecord={player:string;source:string;rank:number;publishedAt?:string|null;url?:string|null};
export type RankingSourceRecord={
  playerId:string;
  player:string;
  position:string|null;
  affiliate:string|null;
  level:string|null;
  score:number;
  previousRank:number|null;
  rank:number;
  change:number;
  mediaMentions:number;
  reasons:string[];
  components?:Record<string,number>;
  historicalScore?:number|null;
};
export type RankingIntelligence={
  player:string;
  modelVersion:string;
  confidence:'high'|'moderate'|'low';
  confidenceScore:number;
  consensusRank:number|null;
  consensusDifference:number|null;
  consensusAgreement:number|null;
  externalSourceCount:number;
  historicalSignal:number|null;
  defenseSignal:number|null;
  pitchQualitySignal:number|null;
  limitations:string[];
  breakdown:{component:string;raw:number;weight:number;contribution:number;available:boolean}[];
};
export type EnrichedRankingRecord=RankingSourceRecord&{intelligence:RankingIntelligence};

const rankings=rankingsData.records as RankingSourceRecord[];
const stats=statsData.records as Row[];
const external=externalData.records as ExternalRecord[];
const statByName=new Map(stats.map(row=>[normalizeText(row.player),row]));
const externalByName=new Map<string,ExternalRecord[]>();
for(const row of external){const key=normalizeText(row.player);externalByName.set(key,[...(externalByName.get(key)||[]),row]);}
const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));
const component=(row:RankingSourceRecord,key:string,fallback=50)=>Number.isFinite(Number(row.components?.[key]))?clamp(Number(row.components?.[key])/(key==='risk'?5:key==='movement'||key==='ageLevel'?10:key==='performance'?25:key==='sentiment'?20:30)*100):fallback;

function defenseSignal(stat:Row|undefined){
  const s=stat?.stats;
  if(!s||s.type==='pitching')return null;
  const position=String(stat.position||'').toUpperCase();
  const positionalValue:Record<string,number>={C:85,SS:82,CF:78,'2B':68,'3B':66,RF:56,LF:52,'1B':45,DH:35};
  return positionalValue[position]??null;
}

function pitchQualitySignal(stat:Row|undefined){
  const s=stat?.stats;
  if(!s||s.type!=='pitching')return null;
  const k9=Number(s.kPer9),bb9=Number(s.bbPer9),whip=Number(s.whip);
  if(![k9,bb9,whip].every(Number.isFinite))return null;
  return clamp(50+(k9-9)*6-(bb9-3)*7-(whip-1.25)*25);
}

function developmentSignal(row:RankingSourceRecord){return clamp(50+Number(row.change||0)*7);}

export function rankingIntelligence(row:RankingSourceRecord):RankingIntelligence{
  const stat=statByName.get(normalizeText(row.player));
  const outside=externalByName.get(normalizeText(row.player))||[];
  const consensus=consensusScore(Number(row.rank),outside.map(item=>Number(item.rank)).filter(Number.isFinite),30);
  const defense=defenseSignal(stat);
  const pitchQuality=pitchQualitySignal(stat);
  const development=developmentSignal(row);
  const evaluation=evaluateRanking({scouting:component(row,'scouting'),performance:component(row,'performance'),ageLevel:component(row,'ageLevel'),sentiment:component(row,'sentiment'),movement:component(row,'movement'),risk:100-component(row,'risk'),development,defense:defense??undefined,pitchQuality:pitchQuality??undefined,history:Number.isFinite(Number(row.historicalScore))?Number(row.historicalScore):undefined,consensus:consensus?.agreement});
  return{player:row.player,modelVersion:RANKING_MODEL_VERSION,confidence:evaluation.confidence,confidenceScore:evaluation.confidenceScore,consensusRank:consensus?.meanRank??null,consensusDifference:consensus?.difference??null,consensusAgreement:consensus?.agreement??null,externalSourceCount:consensus?.sourceCount??0,historicalSignal:Number.isFinite(Number(row.historicalScore))?Number(row.historicalScore):null,defenseSignal:defense,pitchQualitySignal:pitchQuality,limitations:evaluation.limitations,breakdown:evaluation.breakdown};
}

export function enrichRankings():EnrichedRankingRecord[]{return rankings.map(row=>({...row,intelligence:rankingIntelligence(row)}));}
