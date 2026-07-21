import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #09162b 0%, #07101f 55%, #040912 100%)',
          color: '#fffaf2',
          fontFamily: 'Inter, sans-serif'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              marginRight: 20,
              borderRadius: 14,
              background: '#e81828',
              color: '#fff',
              fontSize: 40,
              fontWeight: 900,
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic'
            }}
          >
            P
          </div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 900, letterSpacing: '0.05em' }}>
            <span style={{ color: '#ff737e' }}>PROSPECT</span>&nbsp;PULSE
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 62, fontWeight: 900, lineHeight: 1.05, maxWidth: 920 }}>
          Phillies farm system, tracked and ranked.
        </div>
        <div style={{ display: 'flex', marginTop: 24, fontSize: 26, color: '#9facbf', maxWidth: 880 }}>
          Rankings, stats, injuries, and news — all sourced and updated automatically.
        </div>
      </div>
    ),
    size
  );
}
