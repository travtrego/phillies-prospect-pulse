const modules = [
  ['Arizona Fall League', 'Assignments, rosters, performance and development notes.'],
  ['Winter Leagues', 'Caribbean, Australian and other winter-league activity.'],
  ['Rule 5 Tracker', 'Eligibility, protection decisions and roster exposure.'],
  ['40-Man Decisions', 'Adds, removals, option context and roster implications.'],
  ['Minor League Free Agency', 'Eligible players, departures and re-signings.'],
  ['Trades and Releases', 'Organizational additions, departures and related context.'],
  ['Draft Class', 'Signings, assignments, bonuses and early development.'],
  ['International Signings', 'New classes, bonuses, scouting context and assignments.'],
  ['Spring Training', 'Invitations, roster battles and option decisions.']
];

export default function OffseasonPage() {
  return (
    <main>
      <header className="pageHeader"><span className="eyebrow">Year-round coverage</span><h1>Offseason Tracker</h1><p>Prospect monitoring continues after the final minor league game through roster deadlines, winter assignments, signings and spring training.</p></header>
      <section className="offseasonStatus"><div><span className="eyebrow">Current cycle</span><h2>Offseason command board</h2><p>Each module is ready to receive manually curated records before scheduled collection is activated.</p></div><span className="dataStatusPill">Framework active</span></section>
      <section className="offseasonGrid">{modules.map(([title, description]) => <article key={title}><span className="moduleDot" /><h2>{title}</h2><p>{description}</p><div>Awaiting first record</div></article>)}</section>
    </main>
  );
}
