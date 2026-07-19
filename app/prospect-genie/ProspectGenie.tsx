'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type Ranking = { playerId:string|number; player:string; position?:string|null; affiliate?:string|null; level?:string|null; score:number; rank:number; previousRank:number|null; change:number; mediaMentions?:number; reasons?:string[]; components?:Record<string,number> };
type StatRecord = { playerId:string|number; player:string; position?:string; affiliate?:string; level?:string; status?:string; stats?:Record<string,unknown> };
type Injury = { playerId?:string|number; player:string; injury?:string; timeline?:string; status?:string; transactionDate?:string; source?:string; injurySourceType?:string };
type Promotion = { playerId?:string|number; player:string; date:string; fromLevel?:string; toLevel?:string; fromAffiliate?:string; toAffiliate?:string; description?:string; source?:string };
type Article = { id:string; title:string; summary?:string; source:string; url:string; publishedAt:string };

type Props = { rankings:Ranking[]; stats:StatRecord[]; injuries:Injury[]; promotions:Promotion[]; news:Article[]; updatedAt:string };

type Answer = { title:string; summary:string; bullets:string[]; players:Ranking[]; confidence:string; sources:string[]; predictionNote?:string };

const prompts = ['Who is hottest right now?','Who is closest to a promotion?','Which prospects are trending down?','Who are the best breakout candidates?','Show me the biggest injury concerns','Who could reach MLB this season?'];
const norm=(v='')=>v.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const levelValue:Record<string,number>={MLB:5,AAA:4,AA:3,'A+':2,A:1,Rookie:0};

function statLine(record?:StatRecord){
  const s=record?.stats||{}; if(!s.type) return 'No current stat line available.';
  if(s.type==='hitting') return `${s.games??'—'} G · ${Number(s.average??0).toFixed(3)} AVG · ${Number(s.ops??0).toFixed(3)} OPS · ${s.homeRuns??0} HR`;
  return `${s.games??'—'} G · ${s.inningsPitched??'—'} IP · ${Number(s.era??0).toFixed(2)} ERA · ${Number(s.whip??0).toFixed(2)} WHIP · ${Number(s.kPer9??0).toFixed(1)} K/9`;
}

function performanceValue(record?:StatRecord){
  const s=record?.stats||{};
  if(s.type==='hitting') return Number(s.ops||0)*100 + Math.min(Number(s.plateAppearances||0)/20,10);
  if(s.type==='pitching') return Math.max(0,70-Number(s.era||8)*8)+Number(s.kPer9||0)*2-Math.max(0,Number(s.bbPer9||0)-3)*3;
  return 0;
}

function promotionProbability(player:Ranking, stat?:StatRecord, injured=false){
  const level=levelValue[player.level||'Rookie']??0;
  let probability=10+level*12+(player.components?.performance||12.5)*1.2+Math.max(0,player.change)*2;
  if(player.level==='AAA') probability+=18;
  if(injured) probability-=30;
  return Math.max(3,Math.min(92,Math.round(probability)));
}

export default function ProspectGenie({rankings,stats,injuries,promotions,news,updatedAt}:Props){
  const [question,setQuestion]=useState('Who is hottest right now?');
  const [submitted,setSubmitted]=useState('Who is hottest right now?');
  const statsMap=useMemo(()=>new Map(stats.map(s=>[norm(s.player),s])),[stats]);
  const injuredNames=useMemo(()=>new Set(injuries.map(i=>norm(i.player))),[injuries]);

  const answer=useMemo<Answer>(()=>{
    const q=norm(submitted);
    const byName=rankings.find(r=>q.includes(norm(r.player))||norm(r.player).split(' ').every(p=>p.length<4||q.includes(p)));
    const sourceList=['Prospect Pulse rankings','Daily MiLB statistics','Official transactions','Tracked prospect news'];

    if(byName){
      const stat=statsMap.get(norm(byName.player));
      const injury=injuries.find(i=>norm(i.player)===norm(byName.player));
      const playerPromos=promotions.filter(p=>norm(p.player)===norm(byName.player)).slice(0,3);
      const playerNews=news.filter(n=>norm(`${n.title} ${n.summary||''}`).includes(norm(byName.player))||norm(`${n.title} ${n.summary||''}`).includes(norm(byName.player).split(' ').at(-1)||'')).slice(0,3);
      const bullets=[`Current rank: #${byName.rank} with a ${byName.score.toFixed(1)} Prospect Pulse score.`,`Current line: ${statLine(stat)}`,injury?`Health: ${injury.timeline||injury.status||injury.injury||'Currently listed with an injury.'}`:'Health: no current tracked injury.',...(byName.reasons||[]).slice(0,2),...playerPromos.map(p=>`Movement: ${p.description||`${p.fromLevel||'Lower level'} to ${p.toLevel||'higher level'}`}`),...playerNews.map(n=>`Coverage: ${n.title} (${n.source})`)].slice(0,7);
      const prob=promotionProbability(byName,stat,Boolean(injury));
      return {title:`Genie report: ${byName.player}`,summary:`${byName.player} is currently the system's #${byName.rank} prospect in the Prospect Pulse model.`,bullets,players:[byName],confidence:playerNews.length+playerPromos.length+(stat?1:0)>=3?'High':'Moderate',sources:sourceList,predictionNote:`Heuristic promotion probability over the next 60 days: ${prob}%. This is a model estimate, not inside information.`};
    }

    if(q.includes('injur')||q.includes('health')){
      const players=rankings.filter(r=>injuredNames.has(norm(r.player))).slice(0,5);
      return {title:'Biggest tracked injury concerns',summary:'These ranked players currently have an official or news-linked injury signal.',bullets:players.map(p=>{const i=injuries.find(x=>norm(x.player)===norm(p.player));return `#${p.rank} ${p.player}: ${i?.timeline||i?.status||i?.injury||'injury status tracked'}`;}),players,confidence:'High for roster status; lower for diagnosis details',sources:['Official MLB/MiLB transactions','Prospect Pulse injury tracker']};
    }

    if(q.includes('promotion')||q.includes('called up')||q.includes('reach mlb')||q.includes('closest')){
      const players=[...rankings].filter(r=>!injuredNames.has(norm(r.player))).sort((a,b)=>promotionProbability(b,statsMap.get(norm(b.player)),false)-promotionProbability(a,statsMap.get(norm(a.player)),false)).slice(0,5);
      return {title:'Best near-term promotion candidates',summary:'The Genie combines level, current performance, ranking strength, movement and health.',bullets:players.map(p=>`${p.player}: ${promotionProbability(p,statsMap.get(norm(p.player)),false)}% heuristic 60-day promotion probability · ${p.level||'level unknown'} · ${statLine(statsMap.get(norm(p.player)))}`),players,confidence:'Moderate',sources:sourceList,predictionNote:'These probabilities are transparent heuristics and will improve as historical promotion outcomes accumulate.'};
    }

    if(q.includes('down')||q.includes('fall')||q.includes('stock down')){
      const players=[...rankings].sort((a,b)=>a.change-b.change||a.score-b.score).slice(0,5);
      return {title:'Prospects trending down',summary:'This view emphasizes ranking movement, lower recent performance and negative availability signals.',bullets:players.map(p=>`#${p.rank} ${p.player}: ${p.change<0?`down ${Math.abs(p.change)} spots`:'no rank drop yet'} · ${statLine(statsMap.get(norm(p.player)))}`),players,confidence:'Moderate',sources:sourceList};
    }

    if(q.includes('breakout')||q.includes('sleeper')){
      const players=[...rankings].filter(r=>r.rank>8&&!injuredNames.has(norm(r.player))).sort((a,b)=>performanceValue(statsMap.get(norm(b.player)))-performanceValue(statsMap.get(norm(a.player)))||b.change-a.change).slice(0,5);
      return {title:'Breakout candidates',summary:'These players combine strong current performance with room to climb the established prospect board.',bullets:players.map(p=>`#${p.rank} ${p.player}: ${statLine(statsMap.get(norm(p.player)))} · Pulse ${p.score.toFixed(1)}`),players,confidence:'Moderate',sources:sourceList,predictionNote:'Breakout status is a developmental signal, not a guarantee of future MLB value.'};
    }

    const players=[...rankings].sort((a,b)=>performanceValue(statsMap.get(norm(b.player)))+b.change*3+(b.components?.sentiment||10)-performanceValue(statsMap.get(norm(a.player)))-a.change*3-(a.components?.sentiment||10)).slice(0,5);
    return {title:'Hottest Phillies prospects',summary:'The Genie balances current production, recent rank movement, sentiment and health rather than relying on one box score.',bullets:players.map(p=>`#${p.rank} ${p.player}: ${statLine(statsMap.get(norm(p.player)))} · sentiment ${p.components?.sentiment?.toFixed(1)??'—'}/20`),players,confidence:'Moderate to high',sources:sourceList};
  },[submitted,rankings,statsMap,injuries,promotions,news,injuredNames]);

  const recentTimeline=[...promotions.slice(0,4).map(p=>({date:p.date,text:p.description||`${p.player} promoted`,type:'Promotion'})),...injuries.slice(0,4).map(i=>({date:i.transactionDate||updatedAt,text:i.status||`${i.player} injury update`,type:'Health'})),...news.slice(0,4).map(n=>({date:n.publishedAt,text:n.title,type:n.source}))].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8);

  return <>
    <section className="genieConsole">
      <div className="genieOrb">🧞</div>
      <div><span className="eyebrow">Ask the farm system</span><h2>What do you want to know?</h2><p>The Genie reads rankings, stats, injuries, promotions and prospect coverage, then explains the answer.</p></div>
      <form onSubmit={e=>{e.preventDefault();setSubmitted(question)}}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask about a player, promotion, trend or injury…"/><button>Ask Genie</button></form>
      <div className="geniePromptRow">{prompts.map(p=><button key={p} onClick={()=>{setQuestion(p);setSubmitted(p)}}>{p}</button>)}</div>
    </section>

    <section className="genieAnswer">
      <div className="genieAnswerHeader"><div><span className="eyebrow">Genie answer</span><h2>{answer.title}</h2></div><span className="confidencePill">{answer.confidence} confidence</span></div>
      <p className="answerSummary">{answer.summary}</p>
      <ul>{answer.bullets.map((b,i)=><li key={`${b}-${i}`}>{b}</li>)}</ul>
      {answer.predictionNote&&<p className="predictionNote">🔮 {answer.predictionNote}</p>}
      {answer.players.length>0&&<div className="answerPlayers">{answer.players.map(p=><Link key={p.playerId} href={`/players/${p.playerId}`}><span>#{p.rank}</span><strong>{p.player}</strong><small>{p.position||'—'} · {p.level||'—'} · {p.score.toFixed(1)}</small></Link>)}</div>}
      <footer><span>Evidence used</span>{answer.sources.map(s=><b key={s}>{s}</b>)}</footer>
    </section>

    <section className="genieGrid">
      <article><span className="eyebrow">Phase 1 + 2</span><h3>Reader and memory</h3><p>{news.length} news items, {promotions.length} promotions and {injuries.length} injury records are available to build player timelines.</p></article>
      <article><span className="eyebrow">Phase 3 + 4</span><h3>Confidence and understanding</h3><p>Answers distinguish official transactions from media reports and combine positive and negative baseball signals.</p></article>
      <article><span className="eyebrow">Phase 5</span><h3>Live Pulse scores</h3><p>{rankings.length} prospects are scored across scouting, performance, sentiment, age-level, movement and risk.</p></article>
      <article><span className="eyebrow">Phase 6 + 7</span><h3>Questions and forecasts</h3><p>The Genie answers natural-language questions and produces transparent promotion and breakout estimates.</p></article>
    </section>

    <section className="genieTimeline"><div className="resultsHeader"><div><span className="eyebrow">System memory</span><h2>Recent timeline</h2></div><span className="status">Updated automatically</span></div>{recentTimeline.map((e,i)=><div className="timelineEvent" key={`${e.date}-${i}`}><time>{new Date(e.date).toLocaleDateString()}</time><span>{e.type}</span><p>{e.text}</p></div>)}</section>
  </>;
}
