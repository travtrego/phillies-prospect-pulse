import { NextRequest, NextResponse } from 'next/server';
import rankingsData from '../../../data/rankings.json';
import statsData from '../../../data/stats.json';
import injuriesData from '../../../data/injuries.json';
import promotionsData from '../../../data/promotions.json';
import newsData from '../../../data/news.json';

export const runtime = 'nodejs';

const normalize = (value = '') => value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const words = (value = '') => new Set(normalize(value).split(' ').filter(word => word.length > 2));

function relevance(query: string, text: string) {
  const queryWords = words(query);
  const textWords = words(text);
  let score = 0;
  for (const word of queryWords) if (textWords.has(word)) score += word.length > 6 ? 3 : 1;
  if (normalize(text).includes(normalize(query))) score += 10;
  return score;
}

function compactContext(question: string) {
  const rankings = rankingsData.records
    .map(record => ({ ...record, _score: relevance(question, `${record.player} ${record.position || ''} ${record.level || ''} ${(record.reasons || []).join(' ')}`) }))
    .sort((a, b) => b._score - a._score || a.rank - b.rank)
    .slice(0, 18)
    .map(({ _score, ...record }) => record);

  const selectedNames = new Set(rankings.map(record => normalize(record.player)));
  const stats = statsData.records
    .filter(record => selectedNames.has(normalize(record.player)) || relevance(question, `${record.player} ${record.position || ''} ${record.level || ''}`) > 0)
    .slice(0, 25);

  const injuries = injuriesData.records
    .filter(record => selectedNames.has(normalize(record.player)) || relevance(question, `${record.player} ${record.status || ''} ${record.timeline || ''}`) > 0)
    .slice(0, 20);

  const promotions = promotionsData.records
    .filter(record => selectedNames.has(normalize(record.player)) || relevance(question, `${record.player} ${record.description || ''} ${record.fromLevel || ''} ${record.toLevel || ''}`) > 0)
    .slice(0, 25);

  const news = newsData.articles
    .map(article => ({ ...article, _score: relevance(question, `${article.title} ${article.summary || ''} ${article.source || ''}`) }))
    .sort((a, b) => b._score - a._score || String(b.publishedAt).localeCompare(String(a.publishedAt)))
    .slice(0, 30)
    .map(({ _score, ...article }) => article);

  return {
    generatedAt: new Date().toISOString(),
    rankingsUpdatedAt: rankingsData.updatedAt,
    statsUpdatedAt: statsData.updatedAt,
    injuriesUpdatedAt: injuriesData.updatedAt,
    promotionsUpdatedAt: promotionsData.updatedAt,
    newsUpdatedAt: newsData.updatedAt,
    rankings,
    stats,
    injuries,
    promotions,
    news,
  };
}

const SYSTEM_PROMPT = `You are Prospect Genie, an expert Phillies minor-league analyst. Answer like an experienced scout and development analyst, not a dashboard.

Rules:
- Use only the supplied Phillies Prospect Pulse evidence. Never invent a statistic, injury, scouting observation, quote, ranking, age, handedness, trend, or probability.
- Synthesize conflicting signals. Explain why results may matter less than development context when the evidence supports that conclusion.
- Separate fact from inference. Label projections and comparisons as estimates.
- Treat official transactions as strongest evidence, then current statistics, then reputable reported coverage, then model sentiment.
- Do not treat repeated stories as independent confirmation.
- When evidence is thin, say so plainly.
- For player comparisons, discuss present performance, level, ranking, risk, health, momentum, strengths, weaknesses, ETA clues, and what each player must do next—but only where supported.
- Explain ranking movement by connecting component scores, current stats, promotions, injuries, and news evidence.
- Identify trends only when there are multiple time-stamped observations. Do not claim a six-week trend from one season-total stat line.
- Prospect DNA concepts such as ceiling, floor, role, readiness, development velocity, comparable players, WAR tier, and promotion probability must be framed as cautious model estimates. Omit them when evidence is insufficient.
- Write a direct conversational answer. No analytics cards, tables, JSON, headings such as 'Phase 1', or feature descriptions.
- Usually write 3-7 concise paragraphs. Bullets are allowed only when they make a comparison or list reasons clearer.
- Finish with a brief confidence statement explaining what supports or limits the answer.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const question = typeof body.question === 'string' ? body.question.trim() : '';
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

    if (!question) return NextResponse.json({ error: 'Ask the Genie a question.' }, { status: 400 });
    if (question.length > 1000) return NextResponse.json({ error: 'Please keep the question under 1,000 characters.' }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'The Genie is built, but OPENAI_API_KEY has not been added to Vercel yet.' }, { status: 503 });
    }

    const evidence = compactContext(question);
    const input = [
      ...history.map((message: { role?: string; content?: string }) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: String(message.content || '').slice(0, 4000),
      })),
      {
        role: 'user',
        content: `Question: ${question}\n\nCurrent evidence:\n${JSON.stringify(evidence)}`,
      },
    ];

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_GENIE_MODEL || 'gpt-5-mini',
        instructions: SYSTEM_PROMPT,
        input,
        max_output_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Prospect Genie OpenAI error:', response.status, detail);
      return NextResponse.json({ error: 'The Genie could not complete that answer. Check the API key, model access, and billing.' }, { status: 502 });
    }

    const result = await response.json();
    const answer = result.output_text || result.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || []).map((item: { text?: string }) => item.text || '').join('') || '';

    if (!answer) return NextResponse.json({ error: 'The Genie returned an empty answer.' }, { status: 502 });
    return NextResponse.json({ answer, evidenceUpdatedAt: evidence.generatedAt });
  } catch (error) {
    console.error('Prospect Genie route error:', error);
    return NextResponse.json({ error: 'The Genie hit an unexpected error.' }, { status: 500 });
  }
}
