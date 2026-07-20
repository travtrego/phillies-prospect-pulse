import statsData from '../../data/stats.json';
import injuriesData from '../../data/injuries.json';
import { enrichRankings } from '../ranking/intelligence';

type Row=Record<string,any>;
const rankings=enrichRankings() as Row[];
const stats=statsData.records as Row[];
const injuries=injuriesData.records as Row[];
const normalize=(value='')=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const statFor=(player:Row)=>stats.find(row=>normalize(row.player)===normalize(player.player));
const injured=(player:Row)=>injuries.some(row=>normalize(row.player)===normalize(player.player));
const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));

export type PositionGroup={group:string;players:number;eliteProspects:number;averageScore:number;nearTerm:number;injured:number;depthScore:number;leaders:string[]};
export type OrganizationReport={systemScore:number;strengths:PositionGroup[];weaknesses:PositionGroup[];surpluses:PositionGroup[];blockedPlayers:{player:string;group:string;reason:string}[];recommendations:string[];groups:PositionGroup[];answer:string};

function groupFor(position=''){
  const p=position.toUpperCase();
  if(['RHP','LHP','P','SP','RP'].includes(p))return'Pitching';
  if(p==='C')return'Catcher';
  if(['SS','2B','3B','1B','IF'].includes(p))return'Infield';
  if(['CF','LF','RF','OF'].includes(p))return'Outfield';
  return'Other';
}
function levelWeight(level?:string){return({MLB:100,AAA:82,AA:64,'A+':46,A:30,Rookie:15}[level||'']||20);}
function buildGroups():PositionGroup[]{
  return['Pitching','Catcher','Infield','Outfield','Other'].map(group=>{
    const players=rankings.filter(player=>groupFor(player.position)===group);
    const scores=players.map(player=>Number(player.score||0)).filter(Number.isFinite);
    const nearTerm=players.filter(player=>['AAA','AA'].includes(statFor(player)?.level||player.level)).length;
    const eliteProspects=players.filter(player=>Number(player.rank||999)<=10).length;
    const injuryCount=players.filter(injured).length;
    const quality=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0;
    const proximity=players.length?players.reduce((sum,player)=>sum+levelWeight(statFor(player)?.level||player.level),0)/players.length:0;
    const depthScore=clamp(quality*.55+proximity*.25+Math.min(players.length,8)*3+eliteProspects*3-injuryCount*4);
    const leaders=[...players].sort((a,b)=>Number(a.rank)-Number(b.rank)).slice(0,3).map(player=>player.player);
    return{group,players:players.length,eliteProspects,averageScore:Number(quality.toFixed(1)),nearTerm,injured:injuryCount,depthScore:Number(depthScore.toFixed(1)),leaders};
  }).filter(group=>group.players>0).sort((a,b)=>b.depthScore-a.depthScore);
}
function blockedPlayers(groups:PositionGroup[]){
  const crowded=new Set(groups.filter(group=>group.players>=6&&group.depthScore>=60).map(group=>group.group));
  return rankings.filter(player=>{const level=statFor(player)?.level||player.level;return crowded.has(groupFor(player.position))&&['AAA','AA'].includes(level)&&Number(player.rank)>5;}).sort((a,b)=>Number(a.rank)-Number(b.rank)).slice(0,5).map(player=>({player:player.player,group:groupFor(player.position),reason:`Near the upper minors in a crowded ${groupFor(player.position).toLowerCase()} pipeline.`}));
}
function recommendations(groups:PositionGroup[],blocked:{player:string;group:string;reason:string}[]){
  const strongest=groups[0],weakest=groups.at(-1);
  const output=[`Use ${strongest.group.toLowerCase()} depth as the system's primary trade and roster-management leverage.`,`Prioritize amateur and international acquisition in ${weakest?.group.toLowerCase()||'the weakest position group'}.`];
  if(blocked.length)output.push(`Create playing-time or trade paths for ${blocked.slice(0,2).map(player=>player.player).join(' and ')} before their development stalls.`);
  const injuredGroup=[...groups].sort((a,b)=>b.injured-a.injured)[0];
  if(injuredGroup?.injured)output.push(`Maintain extra depth in ${injuredGroup.group.toLowerCase()} because it currently carries the most injury exposure.`);
  return output;
}
export function isOrganizationQuestion(question:string){return /farm system|organization|organizational|system weakness|system strength|depth|blocked|position group|pipeline|future roster|202[7-9]|2030|assistant gm|gm briefing/i.test(question);}
export function analyzeOrganization(question:string):OrganizationReport{
  const groups=buildGroups();
  const strengths=groups.slice(0,2);
  const weaknesses=[...groups].sort((a,b)=>a.depthScore-b.depthScore).slice(0,2);
  const surpluses=groups.filter(group=>group.players>=6||group.eliteProspects>=3).slice(0,3);
  const blocked=blockedPlayers(groups);
  const actions=recommendations(groups,blocked);
  const systemScore=groups.length?Number((groups.reduce((sum,group)=>sum+group.depthScore,0)/groups.length).toFixed(1)):0;
  const focus=/weak|need|lack|thin/i.test(question)?weaknesses:/surplus|trade|blocked/i.test(question)?surpluses:strengths;
  const lines=focus.map((group,index)=>`${index+1}. ${group.group} — depth score ${group.depthScore}/100, ${group.players} tracked prospects and ${group.nearTerm} at Double-A or Triple-A. Leaders: ${group.leaders.join(', ')}.`);
  const answer=`The organizational model rates the Phillies farm system at ${systemScore}/100.\n\n${/weak|need|lack|thin/i.test(question)?'Biggest weaknesses':/surplus|trade|blocked/i.test(question)?'Most usable surpluses':'Biggest strengths'}:\n${lines.join('\n')}\n\nRecommended actions:\n${actions.map((action,index)=>`${index+1}. ${action}`).join('\n')}${blocked.length?`\n\nPotentially blocked players:\n${blocked.map(player=>`- ${player.player}: ${player.reason}`).join('\n')}`:''}\n\nThis is an internal organizational model based on the canonical v4 prospect board, level, performance and injury evidence—not a complete MLB 40-man roster model.`;
  return{systemScore,strengths,weaknesses,surpluses,blockedPlayers:blocked,recommendations:actions,groups,answer};
}
