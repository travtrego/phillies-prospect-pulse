import Link from 'next/link';
import ProspectDirectory, { type HomepageRanking } from './ProspectDirectory';
import newsData from '../data/news.json';
import rankingsData from '../data/rankings.json';
import { getDirectoryPlayers } from '../lib/playerDirectory';

type NewsArticle = { id:string; title:string; summary:string; source:string; url:string; publishedAt:string; tags?:string[] };
function formatNewsDate(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return'Date unavailable';return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date)}
function cleanSummary(summary:string,source:string,title:string){let cleaned=summary.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();if(cleaned.toLowerCase().endsWith(source.toLowerCase()))cleaned=cleaned.slice(0,-source.length).trim();return!cleaned||cleaned.toLowerCase()===title.toLowerCase()?'Open the full story for details.':cleaned}

export default async function Home(){
  const players=await getDirectoryPlayers();
  const homepageRankings=(rankingsData.records as HomepageRanking[]).slice(0,30).sort((a,b)=>a.rank-b.rank);
  const latestStories=[...(newsData.articles as NewsArticle[])].filter(article=>article.title&&article.url&&article.publishedAt).sort((a,b)=>new Date(b.publishedAt).getTime()-new Date(a.publishedAt).getTime()).slice(0,5);
  return <main>
    <header className="siteHeader"><div><div className="eyebrow">Philadelphia Phillies farm system</div><h1>Prospect Pulse</h1><p>Prospect news, scouting reports and full-season rosters in one focused directory.</p></div><div className="headerBadge"><span>Top 30</span><strong>{homepageRankings.length}</strong></div></header>
    <section className="newsPanel newsPanelFull"><div className="panelHeading"><div><span className="eyebrow">Latest news</span><h2>Phillies prospect stories</h2></div><Link className="sectionLink" href="/news">View all news →</Link></div>{latestStories.length>0?<ol className="storyList storyListWide">{latestStories.map((story,index)=><li key={story.id||story.url}><span>{index+1}</span><div><a href={story.url} target="_blank" rel="noreferrer"><strong>{story.title}</strong></a><p>{cleanSummary(story.summary,story.source,story.title)}</p><small>{story.source} · {formatNewsDate(story.publishedAt)}</small></div></li>)}</ol>:<div className="empty"><h3>No current prospect stories found.</h3><p>The daily news updater will add new stories here automatically.</p></div>}</section>
    <ProspectDirectory players={players} rankings={homepageRankings}/>
  </main>;
}
