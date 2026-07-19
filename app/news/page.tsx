import newsFeed from "../../data/news.json";

type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string | null;
  tags: string[];
  injury: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export default function NewsPage() {
  const articles = (newsFeed.articles as NewsArticle[]).slice(0, 40);

  return (
    <main>
      <header className="pageHeader">
        <span className="eyebrow">Phillies prospect coverage</span>
        <h1>News</h1>
        <p>The latest stories from across the Phillies farm system. This same feed now powers injury matching.</p>
      </header>

      {articles.length === 0 ? (
        <div className="emptyStateCompact">
          <strong>No prospect news loaded yet</strong>
          <p>Run the Daily Prospect Update workflow to build the shared news feed.</p>
        </div>
      ) : (
        <section className="fullStoryFeed">
          {articles.map((story, index) => (
            <article className="fullStory" key={story.id}>
              <span className="storyNumber">{index + 1}</span>
              <div>
                <span className="storyMeta">
                  {story.source} · {formatDate(story.publishedAt)} · {story.tags.join(" / ")}
                </span>
                <h2>
                  <a href={story.url} target="_blank" rel="noreferrer">{story.title}</a>
                </h2>
                <p>{story.summary || "Open the source for the full report."}</p>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
