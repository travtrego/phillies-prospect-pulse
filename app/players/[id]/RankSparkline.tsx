import type { RankSnapshotPoint } from '../../../lib/history';

export default function RankSparkline({ points }: { points: RankSnapshotPoint[] }) {
  const values = points.map((point) => point.score).filter((value): value is number => value !== null);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 200;
  const height = 46;
  const pad = 4;
  const step = (width - pad * 2) / (values.length - 1);
  const coords = values
    .map((value, index) => `${pad + index * step},${height - pad - ((value - min) / range) * (height - pad * 2)}`)
    .join(' ');
  const trendUp = values[values.length - 1] >= values[0];
  return (
    <div className="rankSparkline">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
        <polyline points={coords} fill="none" stroke={trendUp ? '#7ce4ad' : '#ff8f98'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Pulse score, last {values.length} snapshots</span>
    </div>
  );
}
