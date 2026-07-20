import Link from 'next/link';
import ProspectDirectory, { type HomepageRanking } from './ProspectDirectory';
import newsData from '../data/news.json';
import statsData from '../data/stats.json';
import promotionsData from '../data/promotions.json';
import injuriesData from '../data/injuries.json';
import { getDirectoryPlayers } from '../lib/playerDirectory';
import { enrichRankings } from '../lib/ranking/intelligence';

type NewsArticle={id:string;title:string;summary:string;source:string;url:string;publishedAt:string;tags?:string[]};
type Promotion={playerId?:number;player:string;date:string;fromAffiliate:string;fromLevel:string;toAffiliate:string;toLevel:string;description?:string};
function formatNewsDate(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return'Date unavailable';return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date)}
function formatDate(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return'Pending';return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(date)}
function cleanSummary(summary:string,source:string,title:string){let cleaned=summary.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();if(cleaned.toLowerCase().endsWith(source.toLowerCase()))cleaned=cleaned.slice(0,-source.length).trim();return!cleaned||cleaned.toLowerCase()===title.toLowerCase()?'Open the full story for details.':cleaned}

export default async function Home(){
 const players=await getDirectoryPlayers();
 const enriched=enrichRankings().slice(0,30).sort((a,b)=>a.rank-b.rank);
 const homepageRankings=enriched.map(record=>({playerId:record.playerId,player:record.player,rank:record.rank})) as HomepageRanking[];
 const latestStories=[...(newsData.articles as NewsArticle[])].filter(article=>article.title&&article.url&&article.publishedAt).sort((a,b)=>new Date(b.publishedAt).getTime()-new Date(a.publishedAt).getTime()).slice(0,5);
 const promotions=[...(promotionsData.records as Promotion[])].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
 const injuries=(injuriesData.records||[]) as Array<{status?:string}>;
 const rankedActive=players.filter(player=>player.mlb_pipeline_rank!==null).length;
 const affiliates=new Set(players.map(player=>player.current_team_name).filter(Boolean)).size;
 return <main>
  <section className="dashboardHero"><div className="dashboardHeroCopy"><span className="eyebrow">Philadelphia Phillies farm system</span><h1>The system at a glance.</h1><p>Current assignments, rankings, development movement, injuries and prospect news—built from official active rosters and refreshed automatically.</p><div className="heroActions"><Link className="primaryButton" href="/rankings">Explore Top 30</Link><Link className="secondaryButton" href="/affiliates">Browse affiliates</Link></div></div><aside className="dataTrustCard"><span className="eyebrow">Data certification</span><div className="trustState"><i className="trustDot"/>Official active rosters</div><div className="trustMetric"><span>Roster type</span><strong>{statsData.rosterType||'Active'}</strong></div><div className="trustMetric"><span>Last refreshed</span><strong>{formatDate(statsData.updatedAt)}</strong></div><div className="trustMetric"><span>Certification</span><strong>Zero-mismatch gate</strong></div></aside></section>
  <section className="dashboardMetrics"><article className="dashboardMetric"><span>Tracked players</span><strong>{players.length}</strong><small>Current organization directory</small></article><article className="dashboardMetric"><span>Ranked prospects</span><strong>{rankedActive}</strong><small>Top-30 identities matched</small></article><article className="dashboardMetric"><span>Affiliates represented</span><strong>{affiliates}</strong><small>Active assignments</small></article><article className="dashboardMetric"><span>Active injury notes</span><strong>{injuries.length}</strong><small>Latest verified feed</small></article></section>
  <section className="dashboardColumns"><article className="dashboardPanel"><div className="panelHeading"><div><span className="eyebrow">Recent movement</span><h2>Promotions and assignments</h2></div><Link className="sectionLink" href="/promotions">View all →</Link></div><ol className="compactTimeline">{promotions.map(record=><li key={`${record.player}-${record.date}-${record.toLevel}`}><time>{formatDate(record.date)}</time><div><strong>{record.player} · {record.toLevel}</strong><p>{record.description||`${record.fromAffiliate} to ${record.toAffiliate}`}</p></div></li>)}</ol></article><article className="dashboardPanel"><div className="panelHeading"><div><span className="eyebrow">Current board</span><h2>Top prospects</h2></div><Link className="sectionLink" href="/rankings">Full board →</Link></div><div className="dashboardRankList">{enriched.slice(0,7).map(record=><Link className="dashboardRankRow" href={`/players/${record.playerId}`} key={record.playerId}><b>#{record.rank}</b><div><strong>{record.player}</strong><small>{record.position||'—'} · {record.level||'—'}</small></div><span>{record.change>0?`▲ ${record.change}`:record.change<0?`▼ ${Math.abs(record.change)}`:'—'}</span></Link>)}</div></article></section>
  <section className="newsPanel newsPanelFull"><div className="panelHeading"><div><span className="eyebrow">Latest news</span><h2>Phillies prospect stories</h2></div><Link className="sectionLink" href="/news">View all news →</Link></div>{latestStories.length>0?<ol className="storyList storyListWide">{latestStories.map((story,index)=><li key={story.id||story.url}><span>{index+1}</span><div><a href={story.url} target="_blank" rel="noreferrer"><strong>{story.title}</strong></a><p>{cleanSummary(story.summary,story.source,story.title)}</p><small>{story.source} · {formatNewsDate(story.publishedAt)}</small></div></li>)}</ol>:<div className="empty"><h3>No current prospect stories found.</h3><p>The next automated refresh will add new stories here.</p></div>}</section>
  <ProspectDirectory players={players} rankings={homepageRankings}/>
 </main>;
}
