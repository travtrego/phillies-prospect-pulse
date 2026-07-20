import rankingsData from '../../data/rankings.json';
import statsData from '../../data/stats.json';
import externalData from '../../data/external-rankings.json';
import { normalizeText } from '../genie/shared';
import { consensusScore, evaluateRanking, RANKING_MODEL_VERSION } from './model';

type Row=Record<string,any>;
type ExternalRecord={player:string;source:string;rank:number;publishedAt?:string|null;url?:string|null};
export type RankingSourceRecord={playerId:string;player:string;position:string|null;affiliate:string|null;level:string|null;score:number;previousRank:number|null;rank:number;change:number;mediaMentions:number;reasons:string[];components?:Record<string,number>;historicalScore?:number|null};
export type RankingIntelligence={player:string;modelVersion:string;modelScore:number;confidence:'high'|'moderate'|'low';confidenceScore:number;consensusRank:number|null;consensusDifference:number|null;consensusAgreement:number|null;externalSourceCount:number;historicalSignal:number|null;defenseSignal:number|null;pitchQualitySignal:number|null;limitations:string[];breakdown:{component:string;raw:number;weight:number;contribution:number;available:boolean}[]};
export type EnrichedRankingRecord=RankingSourceRecord&{legacyRank:number;legacyScore:number;intelligence:RankingIntelligence};

const rankings=rankingsData.records as RankingSourceRecord[];
const stats=statsData.records as Row[];
const external=externalData.records as ExternalRecord[];
const statByName=new Map(stats.map(row=>[normalizeText(row.player),row]));
const externalByName=new Map<string,ExternalRecord[]>();
for(const row of external){const key=normalizeText(row.player);externalByName.set(key,[...(externalByName.get(key)||[]),row]);}
const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));
const componentMaximum:Record<string,number>={scouting:30,performance:25,ageLevel:10,sentiment:20,movement:10,risk:5};
const component=(row:RankingSourceRecord,key:string,fallback=50)=>{const value=Number(row.components?.[key]);const maximum=componentMaximum[key];return Number.isFinite(value)&&maximum?clamp(value/maximum*100):fallback;};

function defenseSignal(stat:Row|undefined){
  const s=stat?.stats;
  if(!s||s.type==='pitching')return null;
  const candidates=[s.defensiveScore,s.fieldingScore,s.defensiveRuns,s.outsAboveAverage];
  const actual=candidates.map(Number).find(Number.isFinite);
  return actual===undefined?null:clamp(actual);
}

function pitchQualitySignal(stat:Row|undefined){
  const s=stat?.stats;
  if(!s||s.type!=='pitching')return null;
  const candidates=[s.pitchQualityScore,s.stuffPlus,s.pitchingPlus];
  const actual=candidates.map(Number).find(Number.isFinite);
  return actual===undefined?null:clamp(actual);
}

function developmentSignal(row:RankingSourceRecord){return clamp(50+Number(row.change||0)*7);}

export function rankingIntelligence(row:RankingSourceRecord):RankingIntelligence{
  const stat=statByName.get(normalizeText(row.player));
  const outside=externalByName.get(normalizeText(row.player))||[];
  const outsideRanks=outside.map(item=>Number(item.rank)).filter(Number.isFinite);
  const consensus=outsideRanks.length?consensusScore(Number(row.rank),outsideRanks,30):null;
  const defense=defenseSignal(stat);
  const pitchQuality=pitchQualitySignal(stat);
  const development=developmentSignal(row);
  const evaluation=evaluateRanking({scouting:component(row,'scouting'),performance:component(row,'performance'),ageLevel:component(row,'ageLevel'),sentiment:component(row,'sentiment'),movement:component(row,'movement'),risk:component(row,'risk'),development,defense:defense??undefined,pitchQuality:pitchQuality??undefined,history:Number.isFinite(Number(row.historicalScore))?Number(row.historicalScore):undefined,consensus:consensus?.agreement});
  const limitations=[...evaluation.limitations];
  if(defense===null&&!limitations.includes('Defensive-quality input unavailable.'))limitations.push('Defensive-quality input unavailable.');
  if(pitchQuality===null&&!limitations.includes('Pitch-quality input unavailable.'))limitations.push('Pitch-quality input unavailable.');
  return{player:row.player,modelVersion:RANKING_MODEL_VERSION,modelScore:evaluation.score,confidence:evaluation.confidence,confidenceScore:evaluation.confidenceScore,consensusRank:consensus?.meanRank??null,consensusDifference:consensus?.difference??null,consensusAgreement:consensus?.agreement??null,externalSourceCount:consensus?.sourceCount??0,historicalSignal:Number.isFinite(Number(row.historicalScore))?Number(row.historicalScore):null,defenseSignal:defense,pitchQualitySignal:pitchQuality,limitations,breakdown:evaluation.breakdown};
}

export function rankRecords(sourceRecords:RankingSourceRecord[]):EnrichedRankingRecord[]{
  const scored=sourceRecords.map(row=>({row,intelligence:rankingIntelligence(row)}));
  scored.sort((a,b)=>b.intelligence.modelScore-a.intelligence.modelScore||b.intelligence.confidenceScore-a.intelligence.confidenceScore||component(b.row,'ageLevel')-component(a.row,'ageLevel')||a.row.player.localeCompare(b.row.player));
  return scored.map(({row,intelligence},index)=>{
    const rank=index+1;
    const legacyRank=Number(row.rank);
    const prior=Number(row.previousRank);
    const previousRank=Number.isFinite(prior)&&prior>0?prior:null;
    return{...row,legacyRank,legacyScore:Number(row.score),rank,score:intelligence.modelScore,previousRank,change:previousRank===null?0:previousRank-rank,intelligence};
  });
}

const canonicalRankings=rankRecords(rankings);
export function enrichRankings():EnrichedRankingRecord[]{return canonicalRankings.map(record=>({...record,intelligence:{...record.intelligence,breakdown:record.intelligence.breakdown.map(item=>({...item})),limitations:[...record.intelligence.limitations]}}));}
export function getCanonicalRankingByPlayerId(playerId:string){return canonicalRankings.find(record=>String(record.playerId)===String(playerId))??null;}
export function getCanonicalRankingByName(player:string){return canonicalRankings.find(record=>normalizeText(record.player)===normalizeText(player))??null;}
