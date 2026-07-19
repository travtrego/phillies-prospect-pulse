export default function InjuriesPage() {
  return (
    <main>
      <header className="pageHeader">
        <span className="eyebrow">Player availability</span>
        <h1>Injuries</h1>
        <p>Follow injured-list moves, activations, rehabilitation updates and reported return timelines.</p>
      </header>

      <section className="movementPagePanel">
        <div className="panelHeading">
          <div><span className="eyebrow">Current status</span><h2>Injury tracker</h2></div>
          <span className="dataStatusPill">Feed pending</span>
        </div>
        <div className="emptyStateCompact">
          <strong>No injury records loaded yet</strong>
          <p>Confirmed injuries, confidence labels, expected returns and source links will appear here.</p>
        </div>
      </section>
    </main>
  );
}
