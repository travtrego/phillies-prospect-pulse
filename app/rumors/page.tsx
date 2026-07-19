export default function RumorsPage() {
  return (
    <main>
      <header className="pageHeader">
        <span className="eyebrow">Rumor mill</span>
        <h1>Rumors</h1>
        <p>Unconfirmed prospect chatter kept separate from verified news.</p>
      </header>

      <section className="rumorFeed">
        {[1, 2, 3, 4, 5].map((rumor) => (
          <article className="rumorStory" key={rumor}>
            <span className="storyNumber blue">{rumor}</span>
            <div>
              <span className="storyMeta">Unconfirmed · Placeholder</span>
              <h2>Phillies prospect rumor {rumor}</h2>
              <p>The rumor, originating source, confidence label and any later confirmation will appear here.</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
