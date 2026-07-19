type StatRecord = {
  playerId: number;
  player: string;
  affiliate: string;
  level: string;
  position: string | null;
  status?: string | null;
  bats?: string | null;
  throws?: string | null;
  currentAge?: number | null;
  birthDate?: string | null;
  birthCity?: string | null;
  birthStateProvince?: string | null;
  birthCountry?: string | null;
  height?: string | null;
  weight?: number | null;
  draftYear?: number | null;
  mlbDebutDate?: string | null;
  stats: Record<string, any>;
};

export function normalizeName(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

export function formatAverage(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(3).replace(/^0/, '') : '—';
}

export function buildPlayerEvaluation(record?: StatRecord | null) {
  if (!record || !record.stats?.type) {
    return {
      summary: 'There is not enough current statistical information to write a reliable evaluation yet.',
      strengths: [] as string[],
      concerns: [] as string[],
      sourceLabel: 'Profile pending more data'
    };
  }

  const stats = record.stats;
  const strengths: string[] = [];
  const concerns: string[] = [];
  let summary = '';

  if (stats.type === 'hitting') {
    const avg = Number(stats.average);
    const obp = Number(stats.obp);
    const slg = Number(stats.slg);
    const ops = Number(stats.ops);
    const strikeoutRate = Number(stats.strikeoutRate);
    const walkRate = Number(stats.walkRate);
    const homeRuns = Number(stats.homeRuns || 0);
    const stolenBases = Number(stats.stolenBases || 0);

    if (ops >= .850) strengths.push('He has produced at a well-above-average offensive level.');
    else if (ops >= .760) strengths.push('His overall offensive production has been solid.');
    if (avg >= .290) strengths.push('He is making enough contact to sustain a strong batting average.');
    if (walkRate >= 10) strengths.push('His walk rate points to a selective approach.');
    if (strikeoutRate > 0 && strikeoutRate <= 17) strengths.push('He has kept his strikeout rate under control.');
    if (homeRuns >= 12) strengths.push('The home-run total shows meaningful game power.');
    if (stolenBases >= 15) strengths.push('He is adding value on the bases.');

    if (strikeoutRate >= 25) concerns.push('The strikeout rate creates risk against more advanced pitching.');
    if (walkRate > 0 && walkRate < 7) concerns.push('A low walk rate limits the margin for error when the hits are not falling.');
    if (slg > 0 && slg < .400) concerns.push('The current production does not show much impact power.');
    if (obp > 0 && obp < .320) concerns.push('He needs to reach base more consistently.');

    summary = `${record.player} is hitting ${formatAverage(avg)}/${formatAverage(obp)}/${formatAverage(slg)} with a ${formatAverage(ops)} OPS${homeRuns ? `, ${homeRuns} home runs` : ''}${stolenBases ? ` and ${stolenBases} stolen bases` : ''}. `;
    if (strengths.length) summary += strengths.slice(0, 2).join(' ');
    else summary += 'The current line is useful context, but it does not yet separate him clearly from the rest of the system.';
    if (concerns.length) summary += ` ${concerns[0]}`;
  } else {
    const era = Number(stats.era);
    const whip = Number(stats.whip);
    const kPer9 = Number(stats.kPer9);
    const bbPer9 = Number(stats.bbPer9);
    const innings = stats.inningsPitched ?? '—';

    if (kPer9 >= 10) strengths.push('He is missing bats at a strong rate.');
    if (bbPer9 > 0 && bbPer9 <= 3) strengths.push('His walk rate suggests usable command.');
    if (era > 0 && era <= 3.5) strengths.push('He has limited runs effectively.');
    if (whip > 0 && whip <= 1.2) strengths.push('He has kept traffic off the bases.');

    if (bbPer9 >= 4) concerns.push('Command remains the largest obstacle in the current profile.');
    if (whip >= 1.45) concerns.push('Too many baserunners are creating unnecessary pressure.');
    if (era >= 5) concerns.push('The run prevention has been inconsistent.');

    summary = `${record.player} has logged ${innings} innings with a ${Number.isFinite(era) ? era.toFixed(2) : '—'} ERA, ${Number.isFinite(whip) ? whip.toFixed(2) : '—'} WHIP, ${Number.isFinite(kPer9) ? kPer9.toFixed(1) : '—'} K/9 and ${Number.isFinite(bbPer9) ? bbPer9.toFixed(1) : '—'} BB/9. `;
    if (strengths.length) summary += strengths.slice(0, 2).join(' ');
    else summary += 'The current line provides a baseline, but it is not strong enough on its own to support a firm projection.';
    if (concerns.length) summary += ` ${concerns[0]}`;
  }

  return {
    summary,
    strengths,
    concerns,
    sourceLabel: `Prospect Pulse statistical evaluation · ${record.affiliate}`
  };
}

export type { StatRecord };
