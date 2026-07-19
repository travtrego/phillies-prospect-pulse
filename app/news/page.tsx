export default function NewsPage() {
  return (
    <main>
      <header className="pageHeader">
        <span className="eyebrow">Phillies prospect coverage</span>
        <h1>News</h1>
        <p>The latest stories from across the Phillies farm system.</p>
      </header>

      <section className="fullStoryFeed">
        {[1, 2, 3, 4, 5].map((story) => (
          <article className="fullStory" key={story}>
            <span className="storyNumber">{story}</span>
            <div>
              <span className="storyMeta">News placeholder · Source pending</span>
              <h2>Phillies prospect news story {story}</h2>
              <p>A full story summary, publication date, source link and related player links will appear here.</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
