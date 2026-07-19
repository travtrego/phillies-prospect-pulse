import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Player } from '../../ProspectDirectory';
import statsData from '../../../data/stats.json';
import injuriesData from '../../../data/injuries.json';
import promotionsData from '../../../data/promotions.json';
import { buildPlayerEvaluation, normalizeName, type StatRecord } from '../../../lib/playerProfile';

type StatValue = string | number | null | undefined;
type InjuryRecord = { playerId?:number; player:string; injury:string; timeline:string; status:string; source?:string; transactionDate?:string; injurySourceType?:string };
type PromotionRecord = { playerId?:number; player:string; date:string; fromAffiliate:string; fromLevel:string; toAffiliate:string; toLevel:string; description?:string; source?:string };

async function getPlayer(id:string):Promise<Player|null>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return null;
  const response=await fetch(`${url}/rest/v1/players?select=id,full_name,primary_position,current_level,current_team_name,mlb_pipeline_rank,estimated_arrival_year,bats,throws,source_name,source_last_verified_at,scouting_summary,scouting_grades,scouting_source_url,scouting_last_reviewed_at&id=eq.${id}&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`},next:{revalidate:300}});
  if(!response.ok)return null;
  const players=await response.json();
  return players[0]??null;
}

function formatDate(value:string|null|undefined){if(!value)return'Not available';const date=new Date(value);if(Number.isNaN(date.getTime()))return'Not available';return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(date)}
function samePlayer(recordId:number|undefined,recordName:string,playerId:string,playerName:string){return String(recordId??'')===String(playerId)||normalizeName(recordName)===normalizeName(playerName)}
function displayStat(value:StatValue,decimals=false){if(value===null||value===undefined||value==='')return'—';if(decimals&&typeof value==='number')return value.toFixed(3).replace(/^0/,'');return String(value)}
function birthplace(record?:StatRecord){if(!record)return'Not available';return [record.birthCity,record.birthStateProvince,record.birthCountry].filter(Boolean).join(', ')||'Not available'}

export default async function PlayerProfilePage({params}:{params:Promise<{id:string}>}){
  const{id}=await params;
  const player=await getPlayer(id);
  if(!player)notFound();

  const statRecords=statsData.records as StatRecord[];
  const statRecord=statRecords.find(record=>samePlayer(record.playerId,record.player,id,player.full_name));
  const injury=(injuriesData.records as InjuryRecord[]).find(record=>samePlayer(record.playerId,record.player,id,player.full_name));
  const promotions=(promotionsData.records as PromotionRecord[]).filter(record=>samePlayer(record.playerId,record.player,id,player.full_name)).sort((a,b)=>b.date.localeCompare(a.date));
  const evaluation=buildPlayerEvaluation(statRecord);
  const bats=player.bats||statRecord?.bats||null;
  const throws=player.throws||statRecord?.throws||null;
  const pitcher=statRecord?.stats.type==='pitching'||['P','RHP','LHP'].includes(player.primary_position??'');
  const summary=player.scouting_summary||evaluation.summary;
  const statItems:Array<[string,StatValue]>=pitcher?
    [['G',statRecord?.stats.games],['GS',statRecord?.stats.gamesStarted],['IP',statRecord?.stats.inningsPitched],['ERA',statRecord?.stats.era],['WHIP',statRecord?.stats.whip],['SO',statRecord?.stats.strikeouts],['BB',statRecord?.stats.walks],['K/9',statRecord?.stats.kPer9]]:
    [['G',statRecord?.stats.games],['PA',statRecord?.stats.plateAppearances],['AVG',statRecord?.stats.average],['OBP',statRecord?.stats.obp],['SLG',statRecord?.stats.slg],['OPS',statRecord?.stats.ops],['HR',statRecord?.stats.homeRuns],['SB',statRecord?.stats.stolenBases]];

  return <main>
    <Link className="backLink" href="/">← Back to prospect directory</Link>
    <header className="playerPageHeader premiumHeader"><div className="profileHeroCopy"><div className="profileStatusRow"><span className="eyebrow">{statRecord?.affiliate||player.current_team_name||'Phillies organization'}</span></div><h1>{player.full_name}</h1><p>{player.primary_position||statRecord?.position||'Position unavailable'} · {statRecord?.level||player.current_level||'Level unavailable'} · Bats {bats||'—'} · Throws {throws||'—'}</p><div className="profileQuickFacts"><span><b>Age</b>{statRecord?.currentAge??'Not available'}</span><span><b>Height / Weight</b>{statRecord?.height||'—'} / {statRecord?.weight?`${statRecord.weight} lb`:'—'}</span><span><b>Draft year</b>{statRecord?.draftYear??'Not available'}</span><span><b>ETA</b>{player.estimated_arrival_year??'Not available'}</span></div></div><div className="headerBadge"><span>Org rank</span><strong>{player.mlb_pipeline_rank??'—'}</strong></div></header>

    <nav className="profileSubnav" aria-label="Player profile sections"><a href="#bio">Bio</a><a href="#stats">Stats</a><a href="#scouting">Evaluation</a><a href="#injury">Health</a><a href="#movement">Transactions</a></nav>

    <section className="personalStatsPanel" id="bio"><div className="panelHeading"><div><span className="eyebrow">Player information</span><h2>Biography</h2></div><span className="dataStatusPill">MLB player ID {statRecord?.playerId??'not available'}</span></div><div className="personalStatsGrid"><div><span>Born</span><strong>{formatDate(statRecord?.birthDate)}</strong></div><div><span>Birthplace</span><strong>{birthplace(statRecord)}</strong></div><div><span>Current club</span><strong>{statRecord?.affiliate||player.current_team_name||'Not available'}</strong></div><div><span>Roster status</span><strong>{statRecord?.status||'Not available'}</strong></div><div><span>MLB debut</span><strong>{formatDate(statRecord?.mlbDebutDate)}</strong></div><div><span>Last updated</span><strong>{formatDate(statsData.updatedAt)}</strong></div></div></section>

    <section className="personalStatsPanel" id="stats"><div className="panelHeading"><div><span className="eyebrow">{statsData.season} season</span><h2>Current statistics</h2></div><span className="dataStatusPill">{statRecord?`${statRecord.affiliate} · Updated ${formatDate(statsData.updatedAt)}`:'No current stat line found'}</span></div><div className="personalStatsGrid">{statItems.map(([label,value])=><div key={label}><span>{label}</span><strong>{displayStat(value,['AVG','OBP','SLG','OPS','ERA','WHIP'].includes(label))}</strong></div>)}</div>{statRecord&&!pitcher&&<p className="statsFootnote">BB% {displayStat(statRecord.stats.walkRate)} · K% {displayStat(statRecord.stats.strikeoutRate)} · RBI {displayStat(statRecord.stats.rbi)} · 2B {displayStat(statRecord.stats.doubles)}</p>}{statRecord&&pitcher&&<p className="statsFootnote">BB/9 {displayStat(statRecord.stats.bbPer9)} · H {displayStat(statRecord.stats.hits)} · HR {displayStat(statRecord.stats.homeRuns)} · Saves {displayStat(statRecord.stats.saves)}</p>}</section>

    <section className="playerReportPanel" id="scouting"><div className="panelHeading"><div><span className="eyebrow">Current evaluation</span><h2>What the available evidence says</h2></div><span className="reviewDate">Reviewed {formatDate(player.scouting_last_reviewed_at||statsData.updatedAt)}</span></div><p>{summary}</p>{!player.scouting_summary&&(evaluation.strengths.length>0||evaluation.concerns.length>0)&&<div className="profileTwoColumn"><article><h3>Strengths</h3><ul>{evaluation.strengths.map(item=><li key={item}>{item}</li>)}</ul></article><article><h3>Development questions</h3>{evaluation.concerns.length?<ul>{evaluation.concerns.map(item=><li key={item}>{item}</li>)}</ul>:<p>No major statistical warning is evident in the current line, although a full scouting evaluation requires more than season totals.</p>}</article></div>}{player.scouting_grades&&<div className="profileGrades">{Object.entries(player.scouting_grades).map(([tool,grade])=><div key={tool}><span>{tool}</span><strong>{grade}</strong><div><i style={{width:`${Math.min(100,grade*1.25)}%`}}/></div></div>)}</div>}{player.scouting_source_url&&<a className="sourceButton" href={player.scouting_source_url} target="_blank" rel="noreferrer">Open original scouting source →</a>}<small>{player.scouting_summary?'Public scouting report':'Prospect Pulse statistical evaluation; not a substitute for in-person scouting.'}</small></section>

    <section className="profileTwoColumn"><article className="placeholderPanel" id="injury"><span className="eyebrow">Health</span><h2>Injury status</h2>{injury?<div className="profileDataBlock"><strong>{injury.injury||injury.status}</strong><p>{injury.timeline}</p><p>{injury.status}</p><small>{injury.transactionDate?`Recorded ${formatDate(injury.transactionDate)}`:injury.injurySourceType}</small></div>:<div className="emptyStateCompact"><strong>No active injury note</strong><p>No current injured-list transaction or verified injury report was found.</p></div>}<Link className="sourceButton" href="/injuries">View full injury report →</Link></article><article className="placeholderPanel" id="movement"><span className="eyebrow">Roster history</span><h2>Transactions</h2>{promotions.length>0?<ol className="profileTimeline">{promotions.map(record=><li key={`${record.date}-${record.fromAffiliate}-${record.toAffiliate}`}><time>{formatDate(record.date)}</time><strong>{record.fromLevel} → {record.toLevel}</strong><p>{record.description||`${record.fromAffiliate} to ${record.toAffiliate}`}</p></li>)}</ol>:<div className="emptyStateCompact"><strong>No recorded promotions yet</strong><p>Future affiliate promotions will appear here automatically.</p></div>}</article></section>
    <footer className="profileSourceFooter"><span>Roster source: {player.source_name||'MLB Stats API'}</span><span>Statistics updated: {formatDate(statsData.updatedAt)}</span></footer>
  </main>;
}
