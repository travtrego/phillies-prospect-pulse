import type { GenieResult, PlayerEvidence } from './types';

const rate=(value:unknown,digits=3)=>{const number=Number(value);return Number.isFinite(number)?number.toFixed(digits).replace(/^0/,''):'—'};

function statLine(item:PlayerEvidence){
  const s=item.stat?.stats;
  if(!s?.type)return'no current stat line';
  if(s.type==='pitching')return`${s.inningsPitched??'—'} IP, ${Number(s.era??0).toFixed(2)} ERA, ${Number(s.whip??0).toFixed(2)} WHIP, ${Number(s.kPer9??0).toFixed(1)} K/9 and ${Number(s.bbPer9??0).toFixed(1)} BB/9`;
  return`${rate(s.average)} AVG, ${rate(s.obp)} OBP, ${rate(s.slg)} SLG, ${rate(s.ops)} OPS, ${s.homeRuns??0} HR and ${s.stolenBases??0} SB`;
}

function bioLine(item:PlayerEvidence){
  const bits=[item.stat?.currentAge?`age ${item.stat.currentAge}`:null,item.stat?.birthCountry?`from ${item.stat.birthCountry}`:null,item.stat?.height||null,item.stat?.weight?`${item.stat.weight} lb`:null,item.stat?.bats?`bats ${item.stat.bats}`:null,item.stat?.throws?`throws ${item.stat.throws}`:null].filter(Boolean);
  return bits.join(', ');
}

function profile(item:PlayerEvidence,result:GenieResult){
  const p=item.player;
  let answer=`${p.player} is ranked #${p.rank} by Prospect Pulse and is currently at ${item.stat?.level||p.level||'an unverified level'}.`;
  if(result.intent.asksBiography){const bio=bioLine(item);answer+=` ${bio?`He is ${bio}.`:'Verified biographical details are incomplete in the current feed.'}`;}
  answer+=` His current line is ${statLine(item)}.`;
  if(item.strengths.length)answer+=` The strongest parts of the profile are ${item.strengths.join(' and ')}.`;
  if(item.concerns.length)answer+=` The main concern is ${item.concerns.join(' and ')}.`;
  if(result.intent.asksProjection)answer+=` The model currently scores his ceiling at ${Math.round(item.scores.ceiling)}/100, floor at ${Math.round(item.scores.floor)}/100 and MLB readiness at ${Math.round(item.scores.readiness)}/100.`;
  if(item.injury)answer+=` There is an active health flag: ${item.injury.timeline||item.injury.status||item.injury.injury}.`;
  answer+=` Confidence: ${result.confidence}.`;
  return answer;
}

function compare(items:PlayerEvidence[],result:GenieResult){
  const[a,b]=items;
  if(!a||!b)return'I need two clearly identified players to make a comparison.';
  const metric=result.intent.metric;
  const winner=a.scores[metric]>=b.scores[metric]?a:b;
  return`${a.player.player} is #${a.player.rank} at ${a.stat?.level||a.player.level||'an unverified level'} with ${statLine(a)}. ${b.player.player} is #${b.player.rank} at ${b.stat?.level||b.player.level||'an unverified level'} with ${statLine(b)}.\n\nFor ${metric}, the model leans ${winner.player.player}: ${Math.round(winner.scores[metric])}/100 versus ${Math.round((winner===a?b:a).scores[metric])}/100. ${a.player.player}'s best evidence is ${a.strengths[0]||'the overall profile'}, while the main concern is ${a.concerns[0]||'limited supporting detail'}. ${b.player.player}'s best evidence is ${b.strengths[0]||'the overall profile'}, while the main concern is ${b.concerns[0]||'limited supporting detail'}.\n\nConfidence: ${result.confidence}.`;
}

function list(result:GenieResult){
  if(!result.evidence.length)return`I could not find a player matching every part of that request.${result.limitations.length?` ${result.limitations.join(' ')}`:''}`;
  const metric=result.intent.metric;
  const intro:Record<string,string>={overall:'The strongest overall profiles are',ceiling:'The highest-ceiling profiles are',floor:'The safest current profiles are',performance:'The best current performers are',momentum:'The strongest momentum belongs to',readiness:'The players closest to helping in Philadelphia are',power:'The strongest power profiles are',speed:'The strongest speed profiles are',contact:'The strongest contact profiles are',discipline:'The best plate-discipline profiles are',strikeouts:'The best bat-missing profiles are',command:'The strongest command profiles are',risk:'The profiles carrying the most risk are'};
  const rows=result.evidence.map((item,index)=>`${index+1}. ${item.player.player} — #${item.player.rank}, ${item.stat?.level||item.player.level||'level unavailable'}, ${statLine(item)}. ${metric} score: ${Math.round(item.scores[metric])}/100.${item.strengths[0]?` Best evidence: ${item.strengths[0]}.`:''}${item.concerns[0]?` Main concern: ${item.concerns[0]}.`:''}`);
  return`${intro[metric]||intro.overall}:\n\n${rows.join('\n')}\n\nConfidence: ${result.confidence}.${result.limitations.length?` Limitation: ${result.limitations.join(' ')}`:''}`;
}

export function writeAnswer(result:GenieResult){
  if(result.intent.task==='compare_players')return compare(result.evidence,result);
  if(result.intent.task==='player_profile')return result.evidence[0]?profile(result.evidence[0],result):list(result);
  return list(result);
}
