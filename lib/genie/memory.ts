type Row = Record<string, any>;

const normalize = (value = '') => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export type GenieMemory = {
  activePlayers: string[];
  lastUserQuestion?: string;
  lastAssistantAnswer?: string;
};

export function buildMemory(history: Row[], findPlayerNames: (text: string) => string[]): GenieMemory {
  const activePlayers: string[] = [];
  let lastUserQuestion: string | undefined;
  let lastAssistantAnswer: string | undefined;

  for (const message of [...history].reverse()) {
    const content = String(message?.content || '');
    if (!content) continue;
    if (!lastUserQuestion && message.role === 'user') lastUserQuestion = content;
    if (!lastAssistantAnswer && message.role === 'assistant') lastAssistantAnswer = content;
    for (const name of findPlayerNames(content)) {
      if (!activePlayers.includes(name)) activePlayers.push(name);
    }
    if (activePlayers.length >= 10 && lastUserQuestion && lastAssistantAnswer) break;
  }

  return { activePlayers, lastUserQuestion, lastAssistantAnswer };
}

export function resolveFollowUpPlayers(question: string, memory: GenieMemory) {
  const q = normalize(question);
  if (!memory.activePlayers.length) return [];
  if (/\b(?:the )?first(?: one| player)?\b/.test(q)) return memory.activePlayers.slice(0, 1);
  if (/\b(?:the )?second(?: one| player)?\b/.test(q)) return memory.activePlayers.slice(1, 2);
  if (/\b(?:the )?third(?: one| player)?\b/.test(q)) return memory.activePlayers.slice(2, 3);
  if (/\b(?:he|him|his|that player|this player|that prospect|this prospect)\b/.test(q)) return memory.activePlayers.slice(0, 1);
  if (/\b(?:they|them|those players|these players|compare them|both)\b/.test(q)) return memory.activePlayers.slice(0, 2);
  return [];
}
