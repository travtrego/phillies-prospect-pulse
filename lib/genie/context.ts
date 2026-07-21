import rankingsData from '../../data/rankings.json';
import statsData from '../../data/stats.json';
import injuriesData from '../../data/injuries.json';
import promotionsData from '../../data/promotions.json';
import newsData from '../../data/news.json';
import { enrichRankings } from '../ranking/intelligence';

type StatRow = Record<string, any>;
type InjuryRow = { player: string; status?: string; injury?: string; timeline?: string };
type PromotionRow = { date: string; player: string; fromLevel: string; toLevel: string; fromAffiliate: string; toAffiliate: string };
type NewsRow = { title: string; publishedAt: string; source?: string };

export type GenieContext = { text: string; updatedAt: string; playerNames: string[] };

function statLine(record: StatRow): string {
  const s = record.stats;
  if (s?.type === 'pitching') return `${s.inningsPitched ?? '-'} IP, ${s.era ?? '-'} ERA, ${s.whip ?? '-'} WHIP, ${s.kPer9 ?? '-'} K/9, ${s.bbPer9 ?? '-'} BB/9`;
  if (s?.type === 'hitting') return `${s.average ?? '-'} AVG, ${s.obp ?? '-'} OBP, ${s.slg ?? '-'} SLG, ${s.homeRuns ?? 0} HR, ${s.stolenBases ?? 0} SB`;
  return 'no current stat line';
}

export function buildGenieContext(): GenieContext {
  const rankings = enrichRankings();
  const stats = statsData.records as StatRow[];
  const injuries = injuriesData.records as InjuryRow[];
  const promotions = promotionsData.records as PromotionRow[];
  const news = newsData.articles as NewsRow[];

  const rankingLines = rankings
    .map(record => `#${record.rank} ${record.player} | ${record.position ?? '?'} | ${record.level ?? '?'} | ${record.affiliate ?? '?'} | score ${record.score} | confidence ${record.intelligence.confidence} | change ${record.change > 0 ? '+' : ''}${record.change}${record.previousRank ? ` (was #${record.previousRank})` : ''}${record.reasons?.length ? ` | ${record.reasons.slice(0, 2).join('; ')}` : ''}`)
    .join('\n');

  const statLines = stats
    .map(record => `${record.player} (age ${record.currentAge ?? '?'}, ${record.bats ?? '?'}/${record.throws ?? '?'}, from ${record.birthCountry ?? '?'}): ${statLine(record)}`)
    .join('\n');

  const injuryLines = injuries.length
    ? injuries.map(record => `${record.player}: ${record.status || record.injury || 'health note'} — ${record.timeline || 'no timeline given'}`).join('\n')
    : 'No players currently have an active injury note in the tracked feed.';

  const promotionLines = promotions
    .slice(0, 40)
    .map(record => `${record.date} — ${record.player}: ${record.fromLevel} to ${record.toLevel} (${record.fromAffiliate} to ${record.toAffiliate})`)
    .join('\n');

  const newsLines = news
    .slice(0, 20)
    .map(record => `${record.publishedAt} — ${record.title}`)
    .join('\n');

  const text = [
    `PHILLIES PROSPECT RANKINGS — Prospect Pulse model v4, ${rankings.length} tracked prospects, updated ${(rankingsData as any).updatedAt}. Rookie-level players are intentionally excluded from this ranked board.`,
    rankingLines,
    '',
    `CURRENT SEASON STATISTICS, updated ${(statsData as any).updatedAt}:`,
    statLines,
    '',
    `INJURY REPORT, updated ${(injuriesData as any).updatedAt}:`,
    injuryLines,
    '',
    `RECENT AFFILIATE PROMOTIONS AND TRANSACTIONS (most recent 40), updated ${(promotionsData as any).updatedAt}:`,
    promotionLines,
    '',
    `RECENT NEWS HEADLINES (most recent 20), updated ${(newsData as any).updatedAt}:`,
    newsLines
  ].join('\n');

  const updatedAt = [(rankingsData as any).updatedAt, (statsData as any).updatedAt, (injuriesData as any).updatedAt, (promotionsData as any).updatedAt, (newsData as any).updatedAt]
    .filter(Boolean)
    .sort()
    .pop() || new Date().toISOString();

  return { text, updatedAt, playerNames: rankings.map(record => record.player) };
}
