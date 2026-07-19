import Link from 'next/link';
import ProspectDirectory, { type HomepageRanking, type Player } from './ProspectDirectory';
import newsData from '../data/news.json';
import rankingsData from '../data/rankings.json';
import statsData from '../data/stats.json';

type NewsArticle = { id:string; title:string; summary:string; source:string; url:string; publishedAt:string; tags?:string[] };
type StatRecord = { playerId:number; player:string; affiliate:string; level:string; position:string|null; bats?:string|null; throws?:string|null; currentAge?:number|null; birthDate?:string|null; height?:string|null; weight?:number|null; draftYear?:number|null; stats:Record<string,any> };

const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
function generatedSnapshot(record?:StatRecord){
  const s=record?.stats;
  if(!s?.type) return null;
  const notes:string[]=[];
  if(s.type==='hitting'){
    if(Number(s.ops)>=.850) notes.push('impactful offensive production');
    if(Number(s.average)>=.290) notes.push('strong contact results');
    if(Number(s.strikeoutRate)<=17) notes.push('controlled strikeout rate');
    if(Number(s.walkRate)>=10) notes.push('patient approach');
    if(Number(s.homeRuns)>=12) notes.push('game power');
    if(Number(s.stolenBases)>=15) notes.push('baserunning value');
    if(Number(s.strikeoutRate)>=25) notes.push('with swing-and-miss remaining the primary concern');
    return notes.length?`Prospect Pulse snapshot: ${notes.join(', ')} based on the current ${statsData.season} statistical record.`:`Prospect Pulse snapshot generated from the current ${statsData.season} performance record.`;
  }
  if(Number(s.kPer9)>=10) notes.push('misses bats at a strong rate');
  if(Number(s.bbPer9)<=3) notes.push('shows usable control');
  if(Number(s.era)<=3.5) notes.push('has delivered strong run prevention');
  if(Number(s.whip)<=1.2) notes.push('limits baserunners');
  if(Number(s.bbPer9)>=4) notes.push('with command consistency still the main concern');
  return notes.length?`Prospect Pulse snapshot: ${notes.join(', ')} based on the current ${statsData.season} statistical record.`:`Prospect Pulse snapshot generated from the current ${statsData.season} performance record.`;
}

async function getPlayers(): Promise<Player[]> {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key) return [];
  const response=await fetch(`${url}/rest/v1/players?select=id,full_name,primary_position,current_level,current_team_name,mlb_pipeline_rank,estimated_arrival_year,bats,throws,source_name,source_last_verified_at,scouting_summary,scouting_grades,scouting_source_url,scouting_last_reviewed_at&current_level=in.(AAA,AA,A%2B,A)&order=mlb_pipeline_rank.asc.nullslast,full_name.asc`,{headers:{apikey:key,Authorization:`Bearer ${key}`},next:{revalidate:300}});
  if(!response.ok) throw new Error(`Unable to load players: ${response.status}`);
  const players=await response.json() as Player[];
  const statMap=new Map((statsData.records as StatRecord[]).map(record=>[normalize(record.player),record]));
  return players.map(player=>{
    const record=statMap.get(normalize(player.full_name));
    return {...player,mlb_id:record?.playerId??null,bats:player.bats||record?.bats||null,throws:player.throws||record?.throws||null,current_age:record?.currentAge??null,birth_date:record?.birthDate??null,height:record?.height??null,weight:record?.weight??null,draft_year:record?.draftYear??null,scouting_summary:player.scouting_summary||generatedSnapshot(record),scouting_last_reviewed_at:player.scouting_last_reviewed_at||statsData.updatedAt};
  });
}
function formatNewsDate(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return'Date unavailable';return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date)}
function cleanSummary(summary:string,source:string,title:string){let cleaned=summary.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();if(cleaned.toLowerCase().endsWith(source.toLowerCase()))cleaned=cleaned.slice(0,-source.length).trim();return!cleaned||cleaned.toLowerCase()===title.toLowerCase()?'Open the full story for details.':cleaned}
export default async function Home(){const players=await getPlayers();const homepageRankings=(rankingsData.records as HomepageRanking[]).slice(0,30).sort((a,b)=>a.rank-b.rank);const latestStories=[...(newsData.articles as NewsArticle[])].filter(article=>article.title&&article.url&&article.publishedAt).sort((a,b)=>new Date(b.publishedAt).getTime()-new Date(a.publishedAt).getTime()).slice(0,5);return <main><header className="siteHeader"><div><div className="eyebrow">Philadelphia Phillies farm system</div><h1>Prospect Pulse</h1><p>Prospect news, scouting reports and full-season rosters in one focused directory.</p></div><div className="headerBadge"><span>Top 30</span><strong>{homepageRankings.length}</strong></div></header><section className="newsPanel newsPanelFull"><div className="panelHeading"><div><span className="eyebrow">Latest news</span><h2>Phillies prospect stories</h2></div><Link className="sectionLink" href="/news">View all news →</Link></div>{latestStories.length>0?<ol className="storyList storyListWide">{latestStories.map((story,index)=><li key={story.id||story.url}><span>{index+1}</span><div><a href={story.url} target="_blank" rel="noreferrer"><strong>{story.title}</strong></a><p>{cleanSummary(story.summary,story.source,story.title)}</p><small>{story.source} · {formatNewsDate(story.publishedAt)}</small></div></li>)}</ol>:<div className="empty"><h3>No current prospect stories found.</h3><p>The daily news updater will add new stories here automatically.</p></div>}</section>{players.length===0?<div className="empty"><h3>Supabase connection is waiting.</h3><p>Add the public Supabase environment variables in Vercel to load the player database.</p></div>:<ProspectDirectory players={players} rankings={homepageRankings}/>}</main>}
