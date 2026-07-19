'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

const starters = [
  'Why is Justin Crawford not in Philadelphia yet?',
  'Which prospect is most underrated right now?',
  'Compare the two best pitching prospects in the system.',
  'Who has improved the most recently, and why?',
];

export default function ProspectGenie() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function ask(event?: FormEvent, suggestedQuestion?: string) {
    event?.preventDefault();
    const prompt = (suggestedQuestion ?? question).trim();
    if (!prompt || loading) return;

    const history = messages.slice(-8);
    setMessages(current => [...current, { role: 'user', content: prompt }]);
    setQuestion('');
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/prospect-genie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: prompt, history }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The Genie could not answer.');
      setMessages(current => [...current, { role: 'assistant', content: data.answer }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The Genie could not answer.');
    } finally {
      setLoading(false);
    }
  }

  return <section className="genieChat">
    {messages.length === 0 ? <div className="genieWelcome">
      <div className="genieMark" aria-hidden="true">🧞</div>
      <h1>Prospect Genie</h1>
      <p>Ask anything about the Phillies farm system.</p>
      <div className="starterQuestions">
        {starters.map(starter => <button key={starter} onClick={() => ask(undefined, starter)}>{starter}</button>)}
      </div>
    </div> : <div className="conversation" aria-live="polite">
      {messages.map((message, index) => <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
        <span>{message.role === 'assistant' ? 'Genie' : 'You'}</span>
        <div>{message.content.split('\n').map((line, lineIndex) => line ? <p key={lineIndex}>{line}</p> : <br key={lineIndex} />)}</div>
      </article>)}
      {loading && <article className="message assistant thinking"><span>Genie</span><div><p>Reading the farm system…</p></div></article>}
      {error && <p className="genieError">{error}</p>}
      <div ref={endRef} />
    </div>}

    <form className="genieInput" onSubmit={ask}>
      <textarea
        value={question}
        onChange={event => setQuestion(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void ask();
          }
        }}
        placeholder="Ask the Genie…"
        rows={1}
        maxLength={1000}
        aria-label="Ask the Prospect Genie"
      />
      <button disabled={loading || !question.trim()} aria-label="Send question">↑</button>
    </form>
    <p className="genieDisclaimer">Answers are generated from Prospect Pulse rankings, statistics, transactions, injuries, and tracked reporting. Projections are estimates.</p>
  </section>;
}
