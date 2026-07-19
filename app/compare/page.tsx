export default function ComparePage() {
  const rows = ['Organizational rank','Age','Current level','Affiliate','Position','MLB ETA','Overall projection','Risk profile','Season performance','Last 30 days'];
  return (
    <main>
      <header className="pageHeader"><span className="eyebrow">Side-by-side analysis</span><h1>Compare Prospects</h1><p>Compare development context, scouting tools, ranking position and performance without leaving Prospect Pulse.</p></header>
      <section className="compareControls"><div><label>Player one</label><button>Select prospect</button></div><span>VS</span><div><label>Player two</label><button>Select prospect</button></div></section>
      <section className="compareTable">
        <div className="compareHead"><span>Category</span><strong>Player one</strong><strong>Player two</strong></div>
        {rows.map((row) => <div key={row}><span>{row}</span><b>—</b><b>—</b></div>)}
      </section>
      <section className="compareEmpty"><span className="eyebrow">Comparison insight</span><h2>Select two players to begin</h2><p>The completed view will summarize the most meaningful differences in tools, level, age, performance, projection and development risk.</p></section>
    </main>
  );
}
