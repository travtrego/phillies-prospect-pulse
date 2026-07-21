import type { GenieResult, PlayerEvidence, ProjectionEvidence } from './types';
import { projectionMetricLabel } from './projections';

const rate=(value:unknown,digits=3)=>{const number=Number(value);return Number.isFinite(number)?number.toFixed(digits).replace(/^0/,''):'—'};
const rounded=(value:unknown)=>Math.round(Number(value)||0);
const naturalList=(items:string[])=>items.length<=1?(items[0]||''):items.length===2?`${items[0]} and ${items[1]}`:`${items.slice(0,-1).join(', ')}, and ${items.at(-1)}`;

function statLine(item:PlayerEvidence){
  const s=item.stat?.stats;
  if(!s?.type)return null;
  if(s.type==='pitching')return`${s.inningsPitched??'—'} IP, ${Number(s.era??0).toFixed(2)} ERA, ${Number(s.whip??0).toFixed(2)} WHIP, ${Number(s.kPer9??0).toFixed(1)} K/9 and ${Number(s.bbPer9??0).toFixed(1)} BB/9`;
  return`${rate(s.average)} AVG, ${rate(s.obp)} OBP, ${rate(s.slg)} SLG, ${rate(s.ops)} OPS, ${s.homeRuns??0} HR and ${s.stolenBases??0} SB`;
}

function bioLine(item:PlayerEvidence){
  return [item.stat?.currentAge?`age ${item.stat.currentAge}`:null,item.stat?.birthCountry?`from ${item.stat.birthCountry}`:null,item.stat?.height||null,item.stat?.weight?`${item.stat.weight} lb`:null,item.stat?.bats?`bats ${item.stat.bats}`:null,item.stat?.throws?`throws ${item.stat.throws}`:null].filter(Boolean).join(', ');
}

function driverLine(item:PlayerEvidence){
  const drivers=item.projections?.drivers?.filter(driver=>driver.direction!=='neutral').slice(0,3)||[];
  if(!drivers.length)return'';
  const pieces=drivers.map(driver=>`${driver.factor.toLowerCase()} (${driver.impact>=0?'+':''}${driver.impact})`);
  return` The largest modeled drivers are ${naturalList(pieces)}.`;
}

function projectionLine(item:PlayerEvidence){
  const p=item.projections;
  if(!p)return'';
  return`The model estimates a ${rounded(p.mlbProbability)}% MLB outcome score, a ${rounded(p.promotionProbability)}% promotion score and a ${rounded(p.breakoutProbability)}% breakout score. The current recommendation is ${p.recommendation.toLowerCase()}.${driverLine(item)}`;
}

function profile(item:PlayerEvidence,result:GenieResult){
  const p=item.player;
  let answer=`${p.player} is ranked #${p.rank} by Prospect Pulse and is currently assigned to ${item.stat?.level||p.level||'an unverified level'}.`;
  if(result.intent.asksBiography){const bio=bioLine(item);answer+=bio?` Available biographical information: ${bio}.`:' Verified biographical details are incomplete in the current feed.';}
  const line=statLine(item);
  answer+=line?` The current statistical line is ${line}.`:' A current statistical line is not available in the feed.';
  if(item.strengths.length)answer+=` The strongest modeled traits are ${naturalList(item.strengths)}.`;
  if(item.concerns.length)answer+=` The main concern${item.concerns.length>1?'s are':' is'} ${naturalList(item.concerns)}.`;
  if(result.intent.asksProjection||result.decisionMetric)answer+=` ${projectionLine(item)}`;
  if(item.injury)answer+=` The current feed also contains a health flag: ${item.injury.timeline||item.injury.status||item.injury.injury||'details unavailable'}.`;
  answer+=` Confidence is ${result.confidence}.`;
  return answer;
}

function compare(items:PlayerEvidence[],result:GenieResult){
  const[a,b]=items;
  if(!a||!b)return'I need two clearly identified players to make a comparison.';
  const metric=result.intent.metric;
  const winner=a.scores[metric]>=b.scores[metric]?a:b;
  const aLine=statLine(a),bLine=statLine(b);
  let answer=`${a.player.player} is ranked #${a.player.rank} at ${a.stat?.level||a.player.level||'an unverified level'}${aLine?` with ${aLine}`:''}. ${b.player.player} is ranked #${b.player.rank} at ${b.stat?.level||b.player.level||'an unverified level'}${bLine?` with ${bLine}`:''}.\n\nFor ${metric}, the model favors ${winner.player.player}, ${rounded(winner.scores[metric])}/100 to ${rounded((winner===a?b:a).scores[metric])}/100.`;
  if(result.decisionMetric){
    const label=projectionMetricLabel(result.decisionMetric);
    const av=Number(a.projections?.[result.decisionMetric]||0),bv=Number(b.projections?.[result.decisionMetric]||0);
    answer+=` For ${label}, ${a.player.player} scores ${rounded(av)}/100 and ${b.player.player} scores ${rounded(bv)}/100.`;
  }
  answer+=` ${a.player.player}'s strongest evidence is ${a.strengths[0]||'the overall profile'}; the leading concern is ${a.concerns[0]||'limited supporting detail'}. ${b.player.player}'s strongest evidence is ${b.strengths[0]||'the overall profile'}; the leading concern is ${b.concerns[0]||'limited supporting detail'}.\n\nConfidence is ${result.confidence}.`;
  return answer;
}

function decisionList(result:GenieResult){
  if(!result.evidence.length)return`I could not find a player matching every part of that request. ${result.limitations.join(' ')}`.trim();
  const key=result.decisionMetric as keyof ProjectionEvidence;
  const label=projectionMetricLabel(key);
  const rows=result.evidence.map((item,index)=>{
    const p=item.projections;
    const score=Number(p?.[key]||0);
    const reasons=p?.rationale?.length?p.rationale.join(', '):item.strengths.join(', ');
    const drivers=p?.drivers?.filter(driver=>driver.direction!=='neutral').slice(0,2).map(driver=>`${driver.factor} ${driver.impact>=0?'+':''}${driver.impact}`).join('; ');
    return`${index+1}. ${item.player.player} — ${label}: ${rounded(score)}/100. Recommendation: ${p?.recommendation||'Monitor'}. The case rests on ${reasons||'the available ranking and performance evidence'}.${drivers?` Main drivers: ${drivers}.`:''}${item.concerns[0]?` Main risk: ${item.concerns[0]}.`:''}`;
  });
  return`Front-office view: ${label}\n\n${rows.join('\n')}\n\nThese are internal model estimates, not guarantees. Confidence is ${result.confidence}.`;
}

const POSITION_LABEL:Record<string,string>={C:'catching',SS:'shortstop',['2B']:'second base',['3B']:'third base',['1B']:'first base',CF:'center field',LF:'left field',RF:'right field',OF:'outfield',IF:'infield'};

function scopePhrase(result:GenieResult){
  const{filters}=result.intent;
  const parts=[filters.position?POSITION_LABEL[filters.position]||filters.position:filters.positionType==='pitcher'?'pitching':filters.positionType==='hitter'?'position-player':null,filters.level?filters.level:null].filter(Boolean);
  return parts.length?` among ${parts.join(', ')} prospects`:'';
}

function taskIntro(result:GenieResult){
  const{task,metric}=result.intent;
  const scope=scopePhrase(result);
  if(task==='injury_report')return`The current health picture${scope} is`;
  if(task==='promotion_report')return`The players with the most relevant recent affiliate movement${scope} are`;
  if(task==='system_summary')return`Here is a snapshot of the tracked system${scope}, ranked by ${metric==='overall'?'overall profile':metric}`;
  const intro:Record<string,string>={overall:'The strongest overall profiles',ceiling:'The highest-ceiling profiles',floor:'The safest current profiles',performance:'The best current performers',momentum:'The strongest momentum belongs to',readiness:'The players closest to helping in Philadelphia',power:'The strongest power profiles',speed:'The strongest speed profiles',contact:'The strongest contact profiles',discipline:'The best plate-discipline profiles',strikeouts:'The best bat-missing profiles',command:'The strongest command profiles',risk:'The profiles carrying the most risk'};
  const suffix=metric==='momentum'?'':' are';
  return`${intro[metric]||intro.overall}${scope}${suffix}`;
}

function list(result:GenieResult){
  if(result.decisionMetric)return decisionList(result);
  if(!result.evidence.length)return`I could not find a player matching every part of that request.${result.limitations.length?` ${result.limitations.join(' ')}`:''}`;
  const metric=result.intent.metric;
  const rows=result.evidence.map((item,index)=>{const line=statLine(item);return`${index+1}. ${item.player.player} — #${item.player.rank}, ${item.stat?.level||item.player.level||'level unavailable'}${line?`, ${line}`:''}. ${metric} score: ${rounded(item.scores[metric])}/100.${item.strengths[0]?` Best evidence: ${item.strengths[0]}.`:''}${item.concerns[0]?` Main concern: ${item.concerns[0]}.`:''}`;});
  return`${taskIntro(result)}:\n\n${rows.join('\n')}\n\nConfidence is ${result.confidence}.${result.limitations.length?` Limitations: ${result.limitations.join(' ')}`:''}`;
}

export function writeAnswer(result:GenieResult){
  if(result.intent.task==='compare_players')return compare(result.evidence,result);
  if(result.intent.task==='player_profile')return result.evidence[0]?profile(result.evidence[0],result):list(result);
  return list(result);
}
