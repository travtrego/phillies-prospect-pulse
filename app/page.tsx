import Link from 'next/link';
import ProspectDirectory, { type Player } from './ProspectDirectory';
import newsData from '../data/news.json';

type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  tags?: string[];
};

async function getPlayers(): Promise<Player[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];

  const response = await fetch(
    `${url}/rest/v1/players?select=id,full_name,primary_position,current_level,current_team_name,mlb_pipeline_rank,estimated_arrival_year,bats,throws,source_name,source_last_verified_at,scouting_summary,scouting_grades,scouting_source_url,scouting_last_reviewed_at&current_level=in.(AAA,AA,A%2B,A)&order=mlb_pipeline_rank.asc.nullslast,full_name.asc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 300 } }
  );

  if (!response.ok) throw new Error(`Unable to load players: ${response.status}`);
  return response.json();
}

function formatNewsDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function cleanSummary(summary: string, source: string, title: string) {
  const cleaned = summary
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();

  const withoutSource = cleaned.replace(new RegExp(`\\s+${source.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, 'i'), '').trim();
  if (!withoutSource || withoutSource.toLowerCase() === title.toLowerCase()) {
    return `${source} · ${formatNewsDate(new Date().toISOString())}`;
  }

  return withoutSource;
}

export default async function Home() {
  const players = await getPlayers();
  const topProspectCount = Math.min(30, players.length);
  const latestStories = [...(newsData.articles as NewsArticle[])]
    .filter(article => article.title && article.url && article.publishedAt)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 5);

  return (
    <main>
      <header className="siteHeader">
        <div>
          <div className="eyebrow">Philadelphia Phillies farm system</div>
          <h1>Prospect Pulse</h1>
          <p>Prospect news, scouting reports and full-season rosters in one focused directory.</p>
        </div>
        <div className="headerBadge"><span>Top 30</span><strong>{topProspectCount}</strong></div>
      </header>

      <section className="newsPanel newsPanelFull">
        <div className="panelHeading">
          <div><span className="eyebrow">Latest news</span><h2>Phillies prospect stories</h2></div>
          <Link className="sectionLink" href="/news">View all news →</Link>
        </div>

        {latestStories.length > 0 ? (
          <ol className="storyList storyListWide">
            {latestStories.map((story, index) => (
              <li key={story.id || story.url}>
                <span>{index + 1}</span>
                <div>
                  <a href={story.url} target="_blank" rel="noreferrer">
                    <strong>{story.title}</strong>
                  </a>
                  <p>{cleanSummary(story.summary, story.source, story.title)}</p>
                  <small>{story.source} · {formatNewsDate(story.publishedAt)}</small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty">
            <h3>No current prospect stories found.</h3>
            <p>The daily news updater will add new stories here automatically.</p>
          </div>
        )}
      </section>

      {players.length === 0 ? (
        <div className="empty">
          <h3>Supabase connection is waiting.</h3>
          <p>Add the public Supabase environment variables in Vercel to load the player database.</p>
        </div>
      ) : (
        <ProspectDirectory players={players} />
      )}
    </main>
  );
}
