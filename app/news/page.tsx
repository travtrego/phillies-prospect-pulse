import newsFeed from "../../data/news.json";

type NewsArticle = {id:string;title:string;summary:string;source:string;url:string;publishedAt:string|null;tags:string[];injury:string|null;};
function formatDate(value:string|null){if(!value)return"Date unavailable";return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(value));}
function formatUpdatedAt(value:string|null){if(!value)return"Waiting for first automated refresh";return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(value));}

export default function NewsPage(){
 const articles=(newsFeed.articles as NewsArticle[]).slice(0,40);
 return <main>
  <header className="pageHeader"><span className="eyebrow">Phillies prospect coverage</span><h1>News</h1><p>The latest stories from across the Phillies farm system. This same feed powers injury matching and ranking sentiment.</p></header>
  <section className="movementPagePanel">
   <div className="panelHeading"><div><span className="eyebrow">Latest coverage</span><h2>Prospect news feed</h2></div><span className="dataStatusPill">Every 6 hours</span></div>
   <p className="muted">Last refreshed: {formatUpdatedAt(newsFeed.updatedAt)}</p>
   {articles.length===0?<div className="emptyStateCompact"><strong>No prospect news loaded yet</strong><p>The next automated prospect refresh will rebuild the shared news feed.</p></div>:<section className="fullStoryFeed">{articles.map((story,index)=><article className="fullStory" key={story.id}><span className="storyNumber">{index+1}</span><div><span className="storyMeta">{story.source} · {formatDate(story.publishedAt)} · {story.tags.join(" / ")}</span><h2><a href={story.url} target="_blank" rel="noreferrer">{story.title}</a></h2><p>{story.summary||"Open the source for the full report."}</p></div></article>)}</section>}
  </section>
 </main>;
}
