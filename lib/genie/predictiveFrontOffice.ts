import statsData from '../../data/stats.json';
import injuriesData from '../../data/injuries.json';
import { enrichRankings } from '../ranking/intelligence';
import { normalizeText } from './shared';

export const GENIE_PREDICTIVE_FRONT_OFFICE_VERSION='10.0.0';

type Row=Record<string,any>;
type RosterPlayer={id:number|null;name:string;position:string;status:string;rosterType:'active'|'40-man'};
export type FutureRosterPlayer={name:string;position:string;group:string;source:'MLB roster'|'prospect projection';projectedYear:number;roleScore:number;confidence:number;reason:string};
export type FutureRoster={season:number;players:FutureRosterPlayer[];prospectArrivals:string[];positionPressure:{group:string;count:number;target:number;pressure:number}[];limitations:string[]};
export type ProtectionDecision={player:string;eligible:'yes'|'no'|'unknown';protectionScore:number;recommendation:'protect'|'monitor'|'defer';reason:string[]};
export type TradePackage={players:string[];packageValue:number;targetTier:'depth'|'regular'|'impact'|'star';fit:'light'|'reasonable'|'aggressive';rationale:string[]};
export type PromotionImpact={player:string;projectedArrival:number;oneYearImpact:string;threeYearImpact:string;rosterCrunch:string[]};
export type PredictiveFrontOfficeReport={
  version:string;
  horizon:number;
  currentRosterSource:'MLB Stats API'|'local fallback';
  futureRosters:FutureRoster[];
  fortyMan:{currentCount:number;projectedAdds:string[];projectedPressure:number;decisions:ProtectionDecision[]};
  rule5:{decisions:ProtectionDecision[];uncertain:string[]};
  tradePackage:TradePackage|null;
  promotionImpacts:PromotionImpact[];
  rosterCrunches:{season:number;group:string;severity:number;players:string[];recommendation:string}[];
  answer:string;
  confidence:'high'|'moderate'|'low';
  limitations:string[];
};

const rankings=enrichRankings();
const stats=statsData.records as Row[];
const injuries=injuriesData.records as Row[];
const statByName=new Map(stats.map(row=>[normalizeText(row.player),row]));
const injuryNames=new Set(injuries.map(row=>normalizeText(row.player)));
const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));
const currentSeason=new Date().getUTCFullYear();

function groupFor(position=''){
  const p=position.toUpperCase();
  if(['P','RHP','LHP','SP','RP'].includes(p))return'Pitching';
  if(p==='C')return'Catcher';
  if(['1B','2B','3B','SS','IF'].includes(p))return'Infield';
  if(['LF','CF','RF','OF'].includes(p))return'Outfield';
  return'Utility';
}

function targetFor(group:string){return group==='Pitching'?13:group==='Catcher'?2:group==='Infield'?6:group==='Outfield'?5:0;}
function levelArrival(level:string,readiness:number){
  if(level==='AAA')return readiness>=72?1:2;
  if(level==='AA')return readiness>=78?1:2;
  if(level==='A+')return readiness>=82?2:3;
  return 3;
}

function prospectRows(){
  return rankings.map(row=>{
    const stat=statByName.get(normalizeText(row.player))||{};
    const level=stat.level||row.level||'Rookie';
    const group=groupFor(row.position||stat.position||'');
    const injured=injuryNames.has(normalizeText(row.player));
    const readiness=clamp(row.score+(level==='AAA'?12:level==='AA'?7:level==='A+'?2:-3)-(injured?18:0));
    const years=levelArrival(level,readiness);
    const arrival=currentSeason+years;
    const roleScore=clamp(row.score*.72+readiness*.28);
    return{...row,level,group,injured,readiness,arrival,roleScore,stat};
  });
}

async function fetchRoster(rosterType:'active'|'40Man'):Promise<RosterPlayer[]>{
  try{
    const response=await fetch(`https://statsapi.mlb.com/api/v1/teams/143/roster?rosterType=${rosterType}`,{next:{revalidate:3600}});
    if(!response.ok)return[];
    const data=await response.json() as any;
    return (data.roster||[]).map((item:any)=>({id:item.person?.id??null,name:item.person?.fullName||'Unknown',position:item.position?.abbreviation||'',status:item.status?.description||'',rosterType:rosterType==='40Man'?'40-man':'active'}));
  }catch{return[];}
}

function fallbackRoster():RosterPlayer[]{return[];}

function futureRoster(active:RosterPlayer[],yearOffset:number):FutureRoster{
  const season=currentSeason+yearOffset;
  const prospects=prospectRows().filter(row=>row.arrival<=season).sort((a,b)=>b.roleScore-a.roleScore||a.rank-b.rank);
  const incumbents=active.map(player=>({name:player.name,position:player.position,group:groupFor(player.position),source:'MLB roster' as const,projectedYear:season,roleScore:60,confidence:yearOffset===1?72:yearOffset===2?55:42,reason:'Current active-roster incumbent retained absent contract, performance or injury evidence requiring removal.'}));
  const projected:FutureRosterPlayer[]=[...incumbents];
  for(const prospect of prospects){
    projected.push({name:prospect.player,position:prospect.position||prospect.stat?.position||'',group:prospect.group,source:'prospect projection',projectedYear:season,roleScore:Number(prospect.roleScore.toFixed(1)),confidence:prospect.arrival===season?68:prospect.arrival<season?74:55,reason:`Projected from rank #${prospect.rank}, ${prospect.level} assignment, v4 score ${prospect.score.toFixed(1)} and estimated readiness ${prospect.readiness.toFixed(1)}.`});
  }
  const selected:FutureRosterPlayer[]=[];
  for(const group of ['Pitching','Catcher','Infield','Outfield']){
    selected.push(...projected.filter(player=>player.group===group).sort((a,b)=>b.roleScore-a.roleScore||b.confidence-a.confidence).slice(0,targetFor(group)));
  }
  while(selected.length<26){
    const extra=projected.filter(player=>!selected.some(item=>item.name===player.name)).sort((a,b)=>b.roleScore-a.roleScore)[0];
    if(!extra)break;
    selected.push(extra);
  }
  const positionPressure=['Pitching','Catcher','Infield','Outfield'].map(group=>{
    const count=projected.filter(player=>player.group===group&&player.roleScore>=55).length;
    const target=targetFor(group);
    return{group,count,target,pressure:clamp((count-target)*18+50)};
  });
  return{season,players:selected.slice(0,26),prospectArrivals:prospects.filter(row=>row.arrival===season).map(row=>row.player),positionPressure,limitations:['Future MLB incumbents are retained without contract-expiration assumptions unless current roster data excludes them.','Role projections use public prospect data and do not include private evaluations or future free-agent signings.']};
}

function protectionDecision(row:ReturnType<typeof prospectRows>[number]):ProtectionDecision{
  const draftYear=Number(row.stat?.draftYear);
  const age=Number(row.stat?.currentAge);
  let eligible:'yes'|'no'|'unknown'='unknown';
  if(Number.isFinite(draftYear)){
    const years=currentSeason-draftYear;
    const threshold=Number.isFinite(age)&&age<=22?5:4;
    eligible=years>=threshold?'yes':'no';
  }
  const proximity=row.level==='AAA'?18:row.level==='AA'?12:row.level==='A+'?5:0;
  const score=clamp(row.score*.62+proximity+(eligible==='yes'?16:eligible==='unknown'?5:0)-(row.injured?10:0));
  const recommendation:ProtectionDecision['recommendation']=eligible==='yes'&&score>=68?'protect':score>=55?'monitor':'defer';
  const reason=[`Prospect rank #${row.rank} with model score ${row.score.toFixed(1)}.`,`${row.level} proximity contributes to the roster decision.`,eligible==='unknown'?'Rule 5 eligibility cannot be confirmed from current public fields.':`Estimated Rule 5 eligibility: ${eligible}.`,row.injured?'Current injury evidence lowers immediate protection urgency.':'No current injury penalty applied.'];
  return{player:row.player,eligible,protectionScore:Number(score.toFixed(1)),recommendation,reason};
}

function tradeTier(question:string):TradePackage['targetTier']{
  if(/superstar|star|ace|all[- ]star/i.test(question))return'star';
  if(/impact|closer|starter|middle of the order/i.test(question))return'impact';
  if(/regular|everyday|rotation/i.test(question))return'regular';
  return'depth';
}

function tradePackage(question:string,matchedPlayers:string[]):TradePackage|null{
  if(!/trade|package|acquire|deal for/i.test(question))return null;
  const pool=prospectRows();
  const selected=matchedPlayers.length?pool.filter(row=>matchedPlayers.some(name=>normalizeText(name)===normalizeText(row.player))):pool.slice(0,3);
  const players=selected.slice(0,4);
  const packageValue=clamp(players.reduce((sum,row)=>sum+row.score*(row.rank<=5?1.15:row.rank<=15?1:.82),0)/Math.max(1,Math.sqrt(players.length)));
  const targetTier=tradeTier(question);
  const requirement={depth:45,regular:62,impact:76,star:90}[targetTier];
  const fit:TradePackage['fit']=packageValue<requirement-10?'light':packageValue>requirement+12?'aggressive':'reasonable';
  return{players:players.map(row=>row.player),packageValue:Number(packageValue.toFixed(1)),targetTier,fit,rationale:[`Package value combines canonical prospect scores, system rank and package size.`,`A ${targetTier} target is modeled with a ${requirement}/100 acquisition threshold.`,fit==='light'?'The package likely needs another meaningful prospect or MLB value.':fit==='aggressive'?'The package may overpay relative to the modeled target tier.':'The package falls within the modeled value band.','The model does not know another club’s private valuations, contract demands or competitive priorities.']};
}

function promotionImpacts(){
  return prospectRows().filter(row=>row.arrival<=currentSeason+3).sort((a,b)=>a.arrival-b.arrival||a.rank-b.rank).slice(0,12).map(row=>{
    const peers=prospectRows().filter(other=>other.player!==row.player&&other.group===row.group&&Math.abs(other.arrival-row.arrival)<=1&&other.rank<=20).map(other=>other.player).slice(0,4);
    return{player:row.player,projectedArrival:row.arrival,oneYearImpact:`Adds a projected ${row.group.toLowerCase()} option with a ${row.roleScore.toFixed(1)} role score.`,threeYearImpact:`Could occupy a ${row.group.toLowerCase()} roster slot by ${row.arrival}, affecting depth and acquisition needs through ${row.arrival+2}.`,rosterCrunch:peers};
  });
}

export function isPredictiveFrontOfficeQuestion(question:string){
  return /future (26-man|roster)|project(ed)? roster|next (one|two|three|1|2|3) seasons?|roster crunch|40-man|rule 5|protect from rule 5|trade package|simulate.*trade|promotion impact|future phillies roster|organizational forecast/i.test(question);
}

export async function buildPredictiveFrontOfficeReport(question:string,matchedPlayers:string[]):Promise<PredictiveFrontOfficeReport>{
  const [activeLive,fortyLive]=await Promise.all([fetchRoster('active'),fetchRoster('40Man')]);
  const active=activeLive.length?activeLive:fallbackRoster();
  const source:PredictiveFrontOfficeReport['currentRosterSource']=activeLive.length?'MLB Stats API':'local fallback';
  const futureRosters=[1,2,3].map(year=>futureRoster(active,year));
  const decisions=prospectRows().map(protectionDecision).sort((a,b)=>b.protectionScore-a.protectionScore);
  const projectedAdds=decisions.filter(item=>item.recommendation==='protect').map(item=>item.player);
  const currentCount=fortyLive.length;
  const projectedPressure=clamp((currentCount+projectedAdds.length-40)*20+50);
  const trade=tradePackage(question,matchedPlayers);
  const impacts=promotionImpacts();
  const rosterCrunches=futureRosters.flatMap(roster=>roster.positionPressure.filter(item=>item.pressure>=68).map(item=>({season:roster.season,group:item.group,severity:item.pressure,players:prospectRows().filter(row=>row.group===item.group&&row.arrival<=roster.season).sort((a,b)=>a.rank-b.rank).slice(0,6).map(row=>row.player),recommendation:`Use promotions, option flexibility or trades to resolve projected ${item.group.toLowerCase()} congestion.`}))).sort((a,b)=>b.severity-a.severity);
  const limitations=[...new Set([...futureRosters.flatMap(roster=>roster.limitations),'Rule 5 eligibility is estimated from draft year and age when available; international signing dates are not fully integrated.','40-man forecasts do not yet include every contract option, waiver outcome, free-agent signing or future draft pick.','Trade-package values are internal estimates, not predictions of another club’s acceptance.'])];
  const confidence:PredictiveFrontOfficeReport['confidence']=activeLive.length&&fortyLive.length?'moderate':'low';
  const headline=`Predictive Front Office v10.0 projects the Phillies organization across ${currentSeason+1}-${currentSeason+3}.`;
  const rosterLines=futureRosters.map(roster=>`- ${roster.season}: ${roster.prospectArrivals.length?roster.prospectArrivals.join(', '):'no new tracked prospect arrivals'}; highest pressure: ${[...roster.positionPressure].sort((a,b)=>b.pressure-a.pressure)[0]?.group||'none'}.`).join('\n');
  const protectLines=decisions.filter(item=>item.recommendation==='protect').slice(0,6).map(item=>`- ${item.player}: ${item.protectionScore}/100 protection score.`).join('\n')||'- No automatic protect recommendation from the current evidence.';
  const tradeLines=trade?`\n\nTrade simulation:\n- Package: ${trade.players.join(', ')}\n- Modeled value: ${trade.packageValue}/100\n- Target tier: ${trade.targetTier}\n- Fit: ${trade.fit}`:'';
  const answer=`${headline}\n\nProjected roster path:\n${rosterLines}\n\n40-man / Rule 5 priorities:\n${protectLines}${tradeLines}\n\nLargest projected roster crunches:\n${rosterCrunches.slice(0,5).map(item=>`- ${item.season} ${item.group}: ${item.players.join(', ')}.`).join('\n')||'- No severe crunch identified in the tracked pool.'}\n\nThis is a scenario model, not a claim that future transactions or roster decisions are certain.`;
  return{version:GENIE_PREDICTIVE_FRONT_OFFICE_VERSION,horizon:3,currentRosterSource:source,futureRosters,fortyMan:{currentCount,projectedAdds,projectedPressure,decisions:decisions.slice(0,15)},rule5:{decisions:decisions.filter(item=>item.eligible!=='no').slice(0,15),uncertain:decisions.filter(item=>item.eligible==='unknown').map(item=>item.player)},tradePackage:trade,promotionImpacts:impacts,rosterCrunches:rosterCrunches.slice(0,12),answer,confidence,limitations};
}
