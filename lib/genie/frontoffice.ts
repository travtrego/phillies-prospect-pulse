import rankingsData from '../../data/rankings.json';
import statsData from '../../data/stats.json';
import injuriesData from '../../data/injuries.json';

type Row=Record<string,any>;
const rankings=rankingsData.records as Row[];
const stats=statsData.records as Row[];
const injuries=injuriesData.records as Row[];
const normalize=(value='')=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const statFor=(name:string)=>stats.find(row=>normalize(row.player)===normalize(name));
const injuryFor=(name:string)=>injuries.find(row=>normalize(row.player)===normalize(name));
const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));

const affiliateByLevel:Record<string,string>={MLB:'Philadelphia Phillies',AAA:'Lehigh Valley IronPigs',AA:'Reading Fightin Phils','A+':'Jersey Shore BlueClaws',A:'Clearwater Threshers',Rookie:'Florida Complex League'};
const nextLevel:Record<string,string|undefined>={Rookie:'A',A:'A+','A+':'AA',AA:'AAA',AAA:'MLB',MLB:undefined};
const positionGroup=(position='')=>{const p=position.toUpperCase();if(['RHP','LHP','P','SP','RP'].includes(p))return'Pitching';if(p==='C')return'Catcher';if(['SS','2B','3B','1B','IF'].includes(p))return'Infield';if(['CF','LF','RF','OF'].includes(p))return'Outfield';return'Other';};

export type FrontOfficePlayer={
  player:string;
  rank:number;
  score:number;
  position:string;
  group:string;
  level:string;
  affiliate:string;
  injured:boolean;
  promotionReadiness:number;
  playingTimePressure:number;
  blockers:string[];
  promotionCase:string[];
  holdCase:string[];
  recommendation:'promote'|'hold'|'rehab'|'monitor';
};

export type FrontOfficeReport={
  subject?:FrontOfficePlayer;
  affiliates:{level:string;affiliate:string;prospects:number;leaders:string[];crowdedGroups:string[]}[];
  promotionBoard:FrontOfficePlayer[];
  bottlenecks:{level:string;group:string;players:string[];severity:number}[];
  developmentActions:string[];
  answer:string;
};

function playerRows(){
  return rankings.map(player=>{
    const stat=statFor(player.player)||{};
    const level=stat.level||player.level||'Rookie';
    const group=positionGroup(player.position);
    const injured=Boolean(injuryFor(player.player));
    const sameSpot=rankings.filter(other=>other.player!==player.player&&(statFor(other.player)?.level||other.level)===level&&positionGroup(other.position)===group);
    const ahead=sameSpot.filter(other=>Number(other.rank||999)<Number(player.rank||999));
    const behind=sameSpot.filter(other=>Number(other.rank||999)>Number(player.rank||999));
    const reasons=Array.isArray(player.reasons)?player.reasons.map(String):[];
    const performance=Number(player.components?.performance||0);
    const ageLevel=Number(player.components?.ageLevel||0);
    const movement=Number(player.components?.movement||0);
    const base=Number(player.score||0)*.62+performance*1.1+ageLevel*.9+movement*.7;
    const readiness=clamp(base-(injured?25:0)-ahead.length*2.5+(level==='AAA'?8:level==='AA'?4:0));
    const pressure=clamp(sameSpot.length*11+ahead.length*9+behind.length*3);
    const promotionCase=[
      Number(player.rank||999)<=5?'Ranks among the system’s highest-priority prospects.':'',
      Number(player.score||0)>=65?'Overall model score is strong enough to support an aggressive assignment.':'',
      performance>=13?'Current performance component supports advancement.':'',
      ageLevel>=8?'Age-versus-level context is favorable.':'',
      movement>=6?'Recent movement signals positive development momentum.':'',
      ...reasons.filter(reason=>/promot|advanced|hot|improv/i.test(reason)).slice(0,2)
    ].filter(Boolean);
    const holdCase=[
      injured?'An active injury or health flag makes development continuity the priority.':'',
      ahead.length>=2?`${ahead.length} higher-ranked ${group.toLowerCase()} prospects share the current level.`:'',
      pressure>=60?'The current affiliate has meaningful playing-time congestion.':'',
      performance<10?'The performance component is not yet forcing a promotion.':'',
      readiness<55?'The combined readiness score remains below the promotion threshold.':''
    ].filter(Boolean);
    const recommendation:FrontOfficePlayer['recommendation']=injured?'rehab':readiness>=70&&pressure<75?'promote':readiness>=58?'monitor':'hold';
    return{player:player.player,rank:Number(player.rank||999),score:Number(player.score||0),position:player.position||'',group,level,affiliate:affiliateByLevel[level]||player.affiliate||level,injured,promotionReadiness:Number(readiness.toFixed(1)),playingTimePressure:Number(pressure.toFixed(1)),blockers:ahead.sort((a,b)=>Number(a.rank)-Number(b.rank)).slice(0,4).map(row=>row.player),promotionCase,holdCase,recommendation};
  });
}

export function isFrontOfficeQuestion(question:string){
  return /why (hasn.?t|has not|isn.?t|is not).*(promot|called up)|should .* be promoted|promotion board|who deserves a promotion|playing time|blocked at|affiliate depth|depth chart|development plan|front office|digital front office|organizational path|next move|what should the phillies do with/i.test(question);
}

export function buildFrontOfficeReport(question:string,matchedPlayers:string[]):FrontOfficeReport{
  const players=playerRows();
  const subjectName=matchedPlayers[0];
  const subject=subjectName?players.find(row=>normalize(row.player)===normalize(subjectName)):undefined;
  const levels=['AAA','AA','A+','A','Rookie'];
  const affiliates=levels.map(level=>{
    const rows=players.filter(row=>row.level===level);
    const groups=['Pitching','Catcher','Infield','Outfield'].map(group=>({group,count:rows.filter(row=>row.group===group).length})).filter(row=>row.count>=3).map(row=>row.group);
    return{level,affiliate:affiliateByLevel[level],prospects:rows.length,leaders:rows.sort((a,b)=>a.rank-b.rank).slice(0,4).map(row=>row.player),crowdedGroups:groups};
  });
  const promotionBoard=players.filter(row=>!row.injured&&row.level!=='MLB').sort((a,b)=>b.promotionReadiness-a.promotionReadiness||a.rank-b.rank).slice(0,8);
  const bottlenecks=levels.flatMap(level=>['Pitching','Catcher','Infield','Outfield'].map(group=>{
    const rows=players.filter(row=>row.level===level&&row.group===group).sort((a,b)=>a.rank-b.rank);
    return{level,group,players:rows.map(row=>row.player),severity:clamp(rows.length*18+rows.filter(row=>row.rank<=10).length*8)};
  })).filter(row=>row.players.length>=3).sort((a,b)=>b.severity-a.severity).slice(0,6);
  const developmentActions=bottlenecks.slice(0,3).map(item=>`Resolve ${item.group.toLowerCase()} congestion at ${affiliateByLevel[item.level]} through promotions, position flexibility or staggered playing time.`);
  if(subject){
    const next=nextLevel[subject.level];
    const headline=subject.recommendation==='promote'?`The model supports promoting ${subject.player} to ${next?affiliateByLevel[next]: 'Philadelphia'}.`:subject.recommendation==='rehab'?`${subject.player}'s next development priority is health and workload restoration, not promotion.`:subject.recommendation==='monitor'?`${subject.player} is close, but the model recommends monitoring rather than an immediate promotion.`:`The model recommends holding ${subject.player} at ${subject.affiliate} for now.`;
    const why=[...subject.promotionCase.map(reason=>`+ ${reason}`),...subject.holdCase.map(reason=>`- ${reason}`)];
    const answer=`${headline}\n\nPromotion readiness: ${subject.promotionReadiness}/100\nPlaying-time pressure: ${subject.playingTimePressure}/100\nCurrent assignment: ${subject.affiliate} (${subject.level})\n${subject.blockers.length?`Internal competition: ${subject.blockers.join(', ')}\n`:''}\nWhy:\n${why.length?why.join('\n'):'- The current dataset does not contain enough specific development evidence for a stronger conclusion.'}\n\nFront-office recommendation: ${subject.recommendation.toUpperCase()}. This recommendation combines prospect quality, performance, age-versus-level, momentum, injury status and competition for playing time. It does not yet include exact plate appearances, innings targets or private scouting reports.`;
    return{subject,affiliates,promotionBoard,bottlenecks,developmentActions,answer};
  }
  const answer=`Phillies development board\n\nTop promotion candidates:\n${promotionBoard.slice(0,5).map((row,index)=>`${index+1}. ${row.player} — ${row.promotionReadiness}/100 readiness, currently ${row.level}; recommendation: ${row.recommendation}.`).join('\n')}\n\nLargest affiliate bottlenecks:\n${bottlenecks.slice(0,4).map(row=>`- ${affiliateByLevel[row.level]} ${row.group}: ${row.players.join(', ')}.`).join('\n')}\n\nRecommended actions:\n${developmentActions.map(item=>`- ${item}`).join('\n')}\n\nThis is a Phillies-only digital front-office model. It explains assignment pressure and promotion logic from the tracked farm-system data rather than expanding into a league-wide product.`;
  return{affiliates,promotionBoard,bottlenecks,developmentActions,answer};
}
