export default function PromotionsPage() {
  return (
    <main>
      <header className="pageHeader">
        <span className="eyebrow">Organizational movement</span>
        <h1>Promotions</h1>
        <p>Track promotions, demotions, assignments and affiliate changes across the Phillies farm system.</p>
      </header>

      <section className="movementPagePanel">
        <div className="panelHeading">
          <div><span className="eyebrow">Latest moves</span><h2>Player assignments</h2></div>
          <span className="dataStatusPill">Feed pending</span>
        </div>
        <div className="emptyStateCompact">
          <strong>No promotion records loaded yet</strong>
          <p>Confirmed level changes, assignment dates, previous affiliates and source links will appear here.</p>
        </div>
      </section>
    </main>
  );
}
