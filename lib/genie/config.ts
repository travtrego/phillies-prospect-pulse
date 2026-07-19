export const GENIE_LEVELS = ['Rookie','A','A+','AA','AAA','MLB'] as const;
export type GenieLevel = typeof GENIE_LEVELS[number];

export const AFFILIATE_BY_LEVEL: Record<GenieLevel,string> = {
  Rookie:'Florida Complex League',
  A:'Clearwater Threshers',
  'A+':'Jersey Shore BlueClaws',
  AA:'Reading Fightin Phils',
  AAA:'Lehigh Valley IronPigs',
  MLB:'Philadelphia Phillies'
};

export const NEXT_LEVEL: Partial<Record<GenieLevel,GenieLevel>> = {
  Rookie:'A', A:'A+', 'A+':'AA', AA:'AAA', AAA:'MLB'
};

export const LEVEL_WEIGHT: Record<GenieLevel,number> = {
  Rookie:15, A:30, 'A+':46, AA:64, AAA:82, MLB:100
};

export const MODEL = {
  injuryPenalty:25,
  projectionHealthPenalty:18,
  promotionHistoryBoost:4,
  syntheticDraftScore:55,
  thresholds:{ promote:70, monitor:58, congestion:60, protectCore:78, protectDevelop:66, tradeChip:62, breakout:68 }
} as const;
