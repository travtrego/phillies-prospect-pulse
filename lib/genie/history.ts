import type { GenieResult, PlayerEvidence } from './types';
import { projectPlayer } from './projections';

const normalize=(value='')=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));

type Snapshot={
  player_id:string;
  player_name:string;
  captured_at:string;
  level?:string;
  organization_rank?:number;
  ranking_score?:number;
  stats?:Record<string,any>;
  model_scores?:Record<string,number>;
  projections?:Record<string,number>;
  source_ids?:string[];
  source_quality?:number;
};

export type HistoricalTrend={
  snapshotCount:number;
  firstDate:string;
  lastDate:string;
  daysCovered:number;
  rankChange:number|null;
  scoreChange:number|null;
  opsChange:number|null;
  eraChange:number|null;
  levelChanged:boolean;
  momentumAdjustment:number;
  evidenceQuality:number;
  sourceIds:string[];
};

function supabaseConfig(){
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url&&key?{url,key}:null;
}

async function fetchSnapshots(playerNames:string[]):Promise<Snapshot[]>{
  const config=supabaseConfig();
  if(!config||!playerNames.length)return[];
  const names=playerNames.map(name=>`\"${name.replace(/\"/g,'')}\"`).join(',');
  const query=new URLSearchParams({
    select:'player_id,player_name,captured_at,level,organization_rank,ranking_score,stats,model_scores,projections,source_ids,source_quality',
    player_name:`in.(${names})`,
    order:'captured_at.asc',
    limit:'1000'
  });
  const response=await fetch(`${config.url}/rest/v1/player_snapshots?${query.toString()}`,{
    headers:{apikey:config.key,Authorization:`Bearer ${config.key}`},
    cache:'no-store'
  });
  if(!response.ok){
    console.error('History fetch failed',response.status,await response.text());
    return[];
  }
  return response.json();
}

function number(value:unknown){const n=Number(value);return Number.isFinite(n)?n:null;}
function trendFor(rows:Snapshot[]):HistoricalTrend|null{
  if(rows.length<2)return null;
  const first=rows[0],last=rows[rows.length-1];
  const firstTime=new Date(first.captured_at).getTime(),lastTime=new Date(last.captured_at).getTime();
  const days=Math.max(1,Math.round((lastTime-firstTime)/86400000));
  const firstRank=number(first.organization_rank),lastRank=number(last.organization_rank);
  const firstScore=number(first.ranking_score),lastScore=number(last.ranking_score);
  const firstOps=number(first.stats?.ops),lastOps=number(last.stats?.ops);
  const firstEra=number(first.stats?.era),lastEra=number(last.stats?.era);
  const rankChange=firstRank!==null&&lastRank!==null?firstRank-lastRank:null;
  const scoreChange=firstScore!==null&&lastScore!==null?lastScore-firstScore:null;
  const opsChange=firstOps!==null&&lastOps!==null?lastOps-firstOps:null;
  const eraChange=firstEra!==null&&lastEra!==null?firstEra-lastEra:null;
  let adjustment=0;
  if(rankChange!==null)adjustment+=clamp(rankChange*2,-15,15);
  if(scoreChange!==null)adjustment+=clamp(scoreChange*.9,-12,12);
  if(opsChange!==null)adjustment+=clamp(opsChange*55,-15,15);
  if(eraChange!==null)adjustment+=clamp(eraChange*4,-15,15);
  if(first.level&&last.level&&first.level!==last.level)adjustment+=8;
  const quality=rows.reduce((sum,row)=>sum+Number(row.source_quality||0),0)/rows.length;
  return{
    snapshotCount:rows.length,
    firstDate:first.captured_at,
    lastDate:last.captured_at,
    daysCovered:days,
    rankChange,
    scoreChange,
    opsChange,
    eraChange,
    levelChanged:Boolean(first.level&&last.level&&first.level!==last.level),
    momentumAdjustment:clamp(adjustment,-25,25),
    evidenceQuality:quality,
    sourceIds:[...new Set(rows.flatMap(row=>row.source_ids||[]))]
  };
}

export async function applyHistoricalIntelligence(result:GenieResult):Promise<GenieResult>{
  const snapshots=await fetchSnapshots(result.evidence.map(item=>item.player.player));
  if(!snapshots.length){
    result.limitations.push('Historical snapshots are not yet available from Supabase, so current-state evidence was used.');
    return result;
  }
  const grouped=new Map<string,Snapshot[]>();
  for(const row of snapshots){const key=normalize(row.player_name);grouped.set(key,[...(grouped.get(key)||[]),row]);}
  for(const item of result.evidence){
    const trend=trendFor(grouped.get(normalize(item.player.player))||[]);
    if(!trend)continue;
    (item as PlayerEvidence&{history?:HistoricalTrend}).history=trend;
    item.scores.momentum=clamp(item.scores.momentum+trend.momentumAdjustment);
    item.scores.overall=clamp(item.scores.overall+trend.momentumAdjustment*.12);
    item.projections=projectPlayer(item);
  }
  result.evidence.sort((a,b)=>{
    if(result.decisionMetric)return Number(b.projections?.[result.decisionMetric]||0)-Number(a.projections?.[result.decisionMetric]||0);
    const direction=result.intent.metric==='risk'?-1:1;
    return direction*(b.scores[result.intent.metric]-a.scores[result.intent.metric]);
  });
  return result;
}
