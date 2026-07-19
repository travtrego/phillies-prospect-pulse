const factors = [
  ['Recent performance', '7-, 14- and 30-day production compared with season and career baselines.'],
  ['Age relative to level', 'Performance is interpreted in the context of developmental age and competition level.'],
  ['Playing time', 'Changes in starts, plate appearances, innings and role are treated as development signals.'],
  ['Organizational movement', 'Promotions, demotions, assignments and 40-man decisions affect momentum.'],
  ['Health', 'Injury status and missed time are included without speculating beyond sourced information.'],
  ['Ranking movement', 'Changes across selected ranking services are stored as historical snapshots.']
];

export default function MethodologyPage() {
  return (
    <main>
      <header className="pageHeader"><span className="eyebrow">Transparent analysis</span><h1>Methodology</h1><p>Prospect Pulse explains how trends, confidence labels and source-backed conclusions are produced.</p></header>
      <section className="methodologyLead"><span className="eyebrow">Stock Up / Stock Down</span><h2>A development signal, not a scouting replacement</h2><p>The score is designed to summarize organizational momentum. It combines measurable performance and contextual events, while scouting reports remain the primary source for long-term projection.</p></section>
      <section className="factorGrid">{factors.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{text}</p></article>)}</section>
      <section className="confidencePanel"><div><span className="eyebrow">Information confidence</span><h2>Every update carries a label</h2></div><div className="confidenceRows"><article><b className="confirmed">Confirmed</b><p>Official transaction, roster or club communication.</p></article><article><b className="credible">Credible report</b><p>Established reporter or trusted publication with attributable sourcing.</p></article><article><b className="unconfirmed">Unconfirmed</b><p>Incomplete or indirect information displayed separately from verified facts.</p></article></div></section>
    </main>
  );
}
