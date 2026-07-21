import Anthropic from '@anthropic-ai/sdk';
import { buildGenieContext } from './context';
import { normalizeText } from './shared';

export type GenieAnswer = { answer: string; matchedPlayers: string[]; confidence: 'high' | 'moderate' | 'low'; limitations: string[] };
type HistoryMessage = { role: 'user' | 'assistant'; content: string };

const SYSTEM_INSTRUCTIONS = `You are Prospect Genie, a chatbot on the Phillies Prospect Pulse website. You answer questions about the Philadelphia Phillies farm system using only the tracked data provided in this system prompt.

Rules:
- Only state facts that are present in the data below. Never invent stats, injuries, rankings, transactions, or biographical details.
- If a question names a player who is not in the tracked data, say so plainly instead of guessing or answering about a different player.
- Ground every specific claim (a rank, a stat line, an injury status) in the data provided so the reader could verify it.
- The rankings are produced by a model, not a human scout — describe them as the model's assessment, not certain fact.
- Keep answers focused and conversational, a few sentences to a short paragraph unless the question asks for a list or comparison.
- Respond with confidence "low" whenever answering the question well would require information not present in the data below.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', description: 'The natural-language answer to the user, grounded only in the provided data.' },
    matchedPlayers: { type: 'array', items: { type: 'string' }, description: 'Full names of any tracked prospects specifically discussed in the answer.' },
    confidence: { type: 'string', enum: ['high', 'moderate', 'low'] },
    limitations: { type: 'array', items: { type: 'string' }, description: 'Short notes on any gaps in the data that limited this answer. Empty array if none.' }
  },
  required: ['answer', 'matchedPlayers', 'confidence', 'limitations'],
  additionalProperties: false
} as const;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

export function reconcileMatchedPlayers(claimed: string[], trackedNames: string[]): { recognized: string[]; unrecognized: string[] } {
  const tracked = new Set(trackedNames.map(normalizeText));
  const recognized: string[] = [];
  const unrecognized: string[] = [];
  for (const name of claimed) {
    if (tracked.has(normalizeText(name))) recognized.push(name);
    else unrecognized.push(name);
  }
  return { recognized, unrecognized };
}

export async function answerGenieQuestion(question: string, history: HistoryMessage[]): Promise<GenieAnswer> {
  const client = getClient();
  if (!client) {
    return {
      answer: "The Genie isn't fully configured yet — the site owner needs to add an ANTHROPIC_API_KEY.",
      matchedPlayers: [],
      confidence: 'low',
      limitations: ['ANTHROPIC_API_KEY is not set.']
    };
  }

  const context = buildGenieContext();

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: [
        { type: 'text', text: SYSTEM_INSTRUCTIONS },
        { type: 'text', text: context.text, cache_control: { type: 'ephemeral', ttl: '1h' } }
      ],
      messages: [
        ...history.slice(-8).map(message => ({ role: message.role, content: message.content })),
        { role: 'user' as const, content: question }
      ],
      output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA } }
    });

    const block = response.content.find(item => item.type === 'text') as { type: 'text'; text: string } | undefined;
    const parsed = JSON.parse(block?.text || '{}');
    const claimed = Array.isArray(parsed.matchedPlayers) ? parsed.matchedPlayers.filter((name: unknown) => typeof name === 'string') : [];
    const { recognized, unrecognized } = reconcileMatchedPlayers(claimed, context.playerNames);
    const limitations = Array.isArray(parsed.limitations) ? parsed.limitations.filter((item: unknown) => typeof item === 'string') : [];
    if (unrecognized.length) limitations.push(`Mentioned player(s) not found in the tracked list: ${unrecognized.join(', ')}.`);

    return {
      answer: typeof parsed.answer === 'string' && parsed.answer.trim() ? parsed.answer : 'The Genie could not produce an answer for that question.',
      matchedPlayers: recognized,
      confidence: unrecognized.length ? 'low' : (['high', 'moderate', 'low'].includes(parsed.confidence) ? parsed.confidence : 'moderate'),
      limitations
    };
  } catch (error) {
    console.error('Prospect Genie Claude request failed:', error);
    return {
      answer: 'The Genie hit an unexpected error reaching its language model. Please try again in a moment.',
      matchedPlayers: [],
      confidence: 'low',
      limitations: ['The Claude API request failed.']
    };
  }
}
