const reports = [
  ['Daily Farm Report', 'Morning', 'Promotions, injuries, standout games, organizational news and immediate development signals.'],
  ['Weekly Organization Report', 'Weekly', 'Biggest risers and fallers, affiliate performance, ranking movement and system-wide themes.'],
  ['Top Performers', 'Daily', 'Best hitters and pitchers across 7-, 14- and 30-day windows.'],
  ['Transaction Roundup', 'As needed', 'Promotions, demotions, assignments, activations, releases and roster additions.'],
  ['Injury Roundup', 'As needed', 'Confirmed IL moves, credible reports, rehabilitation updates and confidence labels.'],
  ['Prospect Stock Report', 'Weekly', 'Transparent Stock Up / Stock Down scores with plain-English reasoning.']
];

export default function ReportsPage() {
  return (
    <main>
      <header className="pageHeader"><span className="eyebrow">AI-ready reporting</span><h1>Reports</h1><p>Structured daily and weekly farm-system briefings designed for automated generation once live data is connected.</p></header>
      <section className="reportHero"><div><span className="eyebrow">Next briefing</span><h2>Daily Farm Report</h2><p>The report template is ready. Promotions, injury updates, standout performances and development trends will populate this briefing.</p></div><span className="dataStatusPill">Generation pending</span></section>
      <section className="reportGrid">
        {reports.map(([name, cadence, description]) => <article key={name}><span>{cadence}</span><h2>{name}</h2><p>{description}</p><button disabled>Preview unavailable</button></article>)}
      </section>
      <section className="reportMethod"><span className="eyebrow">Editorial standard</span><h2>What every report will include</h2><div><span>Source-backed facts</span><span>Clear confidence labels</span><span>Related player links</span><span>Change since prior report</span><span>Concise AI summaries</span><span>Human-readable reasoning</span></div></section>
    </main>
  );
}
