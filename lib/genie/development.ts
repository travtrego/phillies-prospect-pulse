import rankingsData from '../../data/rankings.json';
import statsData from '../../data/stats.json';
import injuriesData from '../../data/injuries.json';
import promotionsData from '../../data/promotions.json';
import { clamp, finite, normalizeText } from './shared';

type Row=Record<string,any>;
type TrendDirection='up'|'down'|'stable'|'unknown';
type DevelopmentStatus='accelerating'|'progressing'|'stable'|'concerning'|'insufficient data';

type Snapshot={
  player_name:string;
  captured_at:string;
  level?:string;
  organization_rank?:number;
  ranking_score?:number;
  stats?:Record<string,any>;
  model_scores?:Record<string,number>;
  source_ids?:string[];
  source_quality?:number;
};

export type SkillTrajectory={
  skill:string;
  current:number|null;
  change:number|null;
  direction:TrendDirection;
  confidence:number;
  evidence:string;
};

export type DevelopmentDossier={
  player:string;
  level:string;
  status:DevelopmentStatus;
  developmentScore:number;
  developmentConfidence:number;
  bestSkill:string;
  biggestConcern:string;
  currentFocus:string;
  nextMilestone:string;
  trajectories:SkillTrajectory[];
  timeline:{date:string;event:string;impact:'positive'|'negative'|'neutral'}[];
  alerts:string[];
  why:string[];
  limitations:string[];
  answer:string;
};

const rankings=rankingsData.records as Row[];
const stats=statsData.records as Row[];
const injuries=injuriesData.records as Row[];
const promotions=promotionsData.records as Row[];
const byName=(rows:Row[],name:string)=>rows.find(row=>normalizeText(row.player)===normalizeText(name));
const allByName=(rows:Row[],name:string)=>rows.filter(row=>normalizeText(row.player)===normalizeText(name));

function supabaseConfig(){
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url&&key?{url,key}:null;
}

async function fetchSnapshots(player:string):Promise<Snapshot[]>{
  const config=supabaseConfig();
  if(!config)return[];
  const query=new URLSearchParams({
    select:'player_name,captured_at,level,organization_rank,ranking_score,stats,model_scores,source_ids,source_quality',
    player_name:`eq.${player}`,
    order:'captured_at.asc',
    limit:'500'
  });
  try{
    const response=await fetch(`${config.url}/rest/v1/player_snapshots?${query.toString()}`,{headers:{apikey:config.key,Authorization:`Bearer ${config.key}`},cache:'no-store'});
    if(!response.ok)return[];
    return response.json();
  }catch{return[];}
}

const num=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?n:null;};
const delta=(first:unknown,last:unknown)=>{const a=num(first),b=num(last);return a===null||b===null?null:b-a;};
const direction=(change:number|null,positiveWhenHigher=true,threshold=.01):TrendDirection=>{
  if(change===null)return'unknown';
  if(Math.abs(change)<threshold)return'stable';
  const positive=positiveWhenHigher?change>0:change<0;
  return positive?'up':'down';
};
const confidence=(snapshots:number,days:number,quality:number)=>clamp(snapshots*10+Math.min(days,120)*.25+quality*.35,15,95);

function hitterTrajectories(first:Row,last:Row,conf:number):SkillTrajectory[]{
  const ops=delta(first.ops,last.ops),k=delta(first.strikeoutRate,last.strikeoutRate),bb=delta(first.walkRate,last.walkRate),slg=delta(first.slg,last.slg),sb=delta(first.stolenBases,last.stolenBases);
  return[
    {skill:'Overall offense',current:num(last.ops),change:ops,direction:direction(ops,true,.015),confidence:conf,evidence:ops===null?'No comparable OPS snapshots.':`OPS changed ${ops>=0?'+':''}${ops.toFixed(3)}.`},
    {skill:'Contact',current:k===null?null:clamp(100-finite(last.strikeoutRate)*2.5),change:k===null?null:-k,direction:direction(k,false,1),confidence:conf,evidence:k===null?'No comparable strikeout-rate snapshots.':`Strikeout rate changed ${k>=0?'+':''}${k.toFixed(1)} points.`},
    {skill:'Plate discipline',current:num(last.walkRate),change:bb,direction:direction(bb,true,1),confidence:conf,evidence:bb===null?'No comparable walk-rate snapshots.':`Walk rate changed ${bb>=0?'+':''}${bb.toFixed(1)} points.`},
    {skill:'Power',current:num(last.slg),change:slg,direction:direction(slg,true,.015),confidence:conf,evidence:slg===null?'No comparable slugging snapshots.':`Slugging changed ${slg>=0?'+':''}${slg.toFixed(3)}.`},
    {skill:'Speed production',current:num(last.stolenBases),change:sb,direction:direction(sb,true,2),confidence:Math.max(20,conf-10),evidence:sb===null?'No comparable stolen-base snapshots.':`Stolen bases changed ${sb>=0?'+':''}${sb.toFixed(0)}.`}
  ];
}

function pitcherTrajectories(first:Row,last:Row,conf:number):SkillTrajectory[]{
  const era=delta(first.era,last.era),k=delta(first.kPer9,last.kPer9),bb=delta(first.bbPer9,last.bbPer9),whip=delta(first.whip,last.whip),ip=delta(first.inningsPitched,last.inningsPitched);
  return[
    {skill:'Run prevention',current:num(last.era),change:era,direction:direction(era,false,.25),confidence:conf,evidence:era===null?'No comparable ERA snapshots.':`ERA changed ${era>=0?'+':''}${era.toFixed(2)}.`},
    {skill:'Bat-missing',current:num(last.kPer9),change:k,direction:direction(k,true,.5),confidence:conf,evidence:k===null?'No comparable K/9 snapshots.':`K/9 changed ${k>=0?'+':''}${k.toFixed(1)}.`},
    {skill:'Command',current:num(last.bbPer9),change:bb,direction:direction(bb,false,.35),confidence:conf,evidence:bb===null?'No comparable BB/9 snapshots.':`BB/9 changed ${bb>=0?'+':''}${bb.toFixed(1)}.`},
    {skill:'Traffic control',current:num(last.whip),change:whip,direction:direction(whip,false,.08),confidence:conf,evidence:whip===null?'No comparable WHIP snapshots.':`WHIP changed ${whip>=0?'+':''}${whip.toFixed(2)}.`},
    {skill:'Workload',current:num(last.inningsPitched),change:ip,direction:direction(ip,true,10),confidence:Math.max(20,conf-10),evidence:ip===null?'No comparable innings snapshots.':`Tracked innings changed ${ip>=0?'+':''}${ip.toFixed(1)}.`}
  ];
}

function currentOnlyTrajectories(stat:Row):SkillTrajectory[]{
  const s=stat.stats||{};
  if(s.type==='pitching')return[
    {skill:'Run prevention',current:num(s.era),change:null,direction:'unknown',confidence:25,evidence:'Current ERA only; no historical comparison.'},
    {skill:'Bat-missing',current:num(s.kPer9),change:null,direction:'unknown',confidence:25,evidence:'Current K/9 only; no historical comparison.'},
    {skill:'Command',current:num(s.bbPer9),change:null,direction:'unknown',confidence:25,evidence:'Current BB/9 only; no historical comparison.'}
  ];
  return[
    {skill:'Overall offense',current:num(s.ops),change:null,direction:'unknown',confidence:25,evidence:'Current OPS only; no historical comparison.'},
    {skill:'Contact',current:num(s.strikeoutRate),change:null,direction:'unknown',confidence:25,evidence:'Current strikeout rate only; no historical comparison.'},
    {skill:'Plate discipline',current:num(s.walkRate),change:null,direction:'unknown',confidence:25,evidence:'Current walk rate only; no historical comparison.'},
    {skill:'Power',current:num(s.slg),change:null,direction:'unknown',confidence:25,evidence:'Current slugging only; no historical comparison.'}
  ];
}

function classify(trajectories:SkillTrajectory[],injured:boolean){
  const known=trajectories.filter(item=>item.direction!=='unknown');
  if(!known.length)return{status:'insufficient data' as DevelopmentStatus,score:50};
  const up=known.filter(item=>item.direction==='up').length;
  const down=known.filter(item=>item.direction==='down').length;
  let score=50+(up-down)*9+known.filter(item=>item.direction==='stable').length*1-(injured?8:0);
  score=clamp(score);
  const status:DevelopmentStatus=score>=72?'accelerating':score>=58?'progressing':score>=45?'stable':'concerning';
  return{status,score};
}

function milestone(stat:Row|undefined,trajectories:SkillTrajectory[],injured:boolean){
  if(injured)return'Restore health and workload before using performance as promotion evidence.';
  const down=trajectories.find(item=>item.direction==='down');
  if(down?.skill==='Contact')return'Maintain the contact gains and avoid a renewed strikeout-rate spike over the next meaningful sample.';
  if(down?.skill==='Command')return'Reduce the walk rate while preserving bat-missing ability over the next several outings.';
  if(down)return`Stabilize ${down.skill.toLowerCase()} before the next assignment decision.`;
  if(stat?.stats?.type==='pitching')return'Hold the current gains across a larger workload without losing command or stuff.';
  return'Hold the current gains across the next 100–150 plate appearances.';
}

export function isDevelopmentQuestion(question:string){
  return /develop|development|getting better|improv|changed since|trend|trajectory|progress|regress|living scouting|dossier|current focus|next milestone|skill growth|actually better|breakout real/i.test(question);
}

export async function buildDevelopmentDossier(playerName:string):Promise<DevelopmentDossier>{
  const ranking=byName(rankings,playerName)||{};
  const stat=byName(stats,playerName);
  const injury=byName(injuries,playerName);
  const playerPromotions=allByName(promotions,playerName).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const snapshots=await fetchSnapshots(playerName);
  const first=snapshots[0],last=snapshots.at(-1);
  const firstStats=first?.stats||{};
  const lastStats=last?.stats||stat?.stats||{};
  const days=first&&last?Math.max(1,Math.round((new Date(last.captured_at).getTime()-new Date(first.captured_at).getTime())/86400000)):0;
  const quality=snapshots.length?snapshots.reduce((sum,row)=>sum+finite(row.source_quality),0)/snapshots.length:0;
  const conf=confidence(snapshots.length,days,quality);
  const trajectories=snapshots.length>=2?(lastStats.type==='pitching'?pitcherTrajectories(firstStats,lastStats,conf):hitterTrajectories(firstStats,lastStats,conf)):(stat?currentOnlyTrajectories(stat):[]);
  const classified=classify(trajectories,Boolean(injury));
  const ordered=[...trajectories].sort((a,b)=>{
    const weight=(d:TrendDirection)=>d==='up'?3:d==='stable'?2:d==='unknown'?1:0;
    return weight(b.direction)-weight(a.direction)||(b.current||0)-(a.current||0);
  });
  const best=ordered.find(item=>item.direction==='up')||ordered[0];
  const concern=trajectories.find(item=>item.direction==='down')||(injury?{skill:'Health'}:undefined);
  const timeline=[
    ...playerPromotions.map(row=>({date:String(row.date||''),event:row.description||`${row.fromLevel||'Previous level'} to ${row.toLevel||'new level'}`,impact:'positive' as const})),
    ...(injury?[{date:String(injury.transactionDate||''),event:`Health flag: ${injury.injury||injury.status||'injury'}`,impact:'negative' as const}]:[]),
    ...(first&&last&&first.level!==last.level?[{date:last.captured_at,event:`Level changed from ${first.level||'unknown'} to ${last.level||'unknown'}.`,impact:'positive' as const}]:[])
  ].filter(item=>item.date).sort((a,b)=>a.date.localeCompare(b.date));
  const alerts:string[]=[];
  trajectories.filter(item=>item.direction==='up').slice(0,2).forEach(item=>alerts.push(`${item.skill} is trending positively: ${item.evidence}`));
  trajectories.filter(item=>item.direction==='down').slice(0,2).forEach(item=>alerts.push(`${item.skill} is trending negatively: ${item.evidence}`));
  if(injury)alerts.push('An active health flag lowers confidence in near-term development conclusions.');
  const why=trajectories.filter(item=>item.direction!=='unknown').sort((a,b)=>Math.abs(b.change||0)-Math.abs(a.change||0)).slice(0,4).map(item=>`${item.skill}: ${item.evidence}`);
  const limitations:string[]=[];
  if(snapshots.length<2)limitations.push('Fewer than two historical snapshots are available, so a true trajectory cannot yet be established.');
  if(!stat)limitations.push('No current stat record is available.');
  limitations.push('Pitch-level data, batted-ball quality, defensive evaluations and private scouting reports are not yet integrated.');
  const level=stat?.level||ranking.level||'unverified level';
  const currentFocus=concern?`Improve or stabilize ${concern.skill.toLowerCase()}.`:`Preserve the strongest recent gain in ${best?.skill.toLowerCase()||'overall performance'}.`;
  const nextMilestone=milestone(stat,trajectories,Boolean(injury));
  const answer=`${playerName} development dossier\n\nOverall development status: ${classified.status.toUpperCase()}\nDevelopment score: ${Math.round(classified.score)}/100\nConfidence: ${Math.round(conf)}%\nCurrent level: ${level}\n\nBest current development signal: ${best?.skill||'Not enough evidence'}${best?` — ${best.evidence}`:''}\nBiggest concern: ${concern?.skill||'No clear negative trend in the available data'}\nCurrent focus: ${currentFocus}\nNext milestone: ${nextMilestone}\n\nSkill trajectories:\n${trajectories.map(item=>`- ${item.skill}: ${item.direction.toUpperCase()}${item.change===null?'':` (${item.change>=0?'+':''}${Number(item.change.toFixed(3))})`} — ${item.evidence}`).join('\n')}\n\nWhy the model reached this view:\n${why.length?why.map(item=>`- ${item}`).join('\n'):'- The system has current-state evidence but not enough comparable history to identify genuine development.'}\n\n${limitations.join(' ')}`;
  return{player:playerName,level,status:classified.status,developmentScore:Math.round(classified.score),developmentConfidence:Math.round(conf),bestSkill:best?.skill||'Unknown',biggestConcern:concern?.skill||'No clear negative trend',currentFocus,nextMilestone,trajectories,timeline,alerts,why,limitations,answer};
}
