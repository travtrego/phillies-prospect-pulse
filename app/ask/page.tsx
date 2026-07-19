'use client';

import { useState } from 'react';

const examples = [
  'Who are the hottest hitters in Double-A?',
  'Which prospects have been promoted this month?',
  'Show all injured pitchers.',
  "Compare Aidan Miller's last 30 days to his season average."
];

export default function AskPage() {
  const [question, setQuestion] = useState('');
  return (
    <main>
      <header className="pageHeader"><span className="eyebrow">Conversational farm system analysis</span><h1>Ask Pulse</h1><p>Explore the prospect database in natural language. The interface is ready for database-grounded answers once historical data and the query service are connected.</p></header>
      <section className="askWorkspace">
        <div className="askInputRow"><input aria-label="Ask a farm system question" placeholder="Ask about players, affiliates, injuries, rankings or trends…" value={question} onChange={(event) => setQuestion(event.target.value)} /><button disabled={!question}>Ask Pulse</button></div>
        <div className="askExamples"><span>Try a question</span>{examples.map((example) => <button key={example} onClick={() => setQuestion(example)}>{example}</button>)}</div>
        <div className="askResponse"><span className="eyebrow">Grounded response</span><h2>{question ? 'Ready to query the connected database' : 'Ask a question to begin'}</h2><p>{question ? 'This response area will return a concise answer, supporting statistics, confidence notes and direct links to the relevant player profiles.' : 'Prospect Pulse will answer using structured statistics, transactions, injuries, rankings and sourced news rather than general web knowledge.'}</p><div className="answerSources"><span>Structured data</span><span>Source citations</span><span>Player links</span><span>Confidence labels</span></div></div>
      </section>
    </main>
  );
}
