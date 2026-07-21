import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecretSet = Boolean(process.env.CRON_SECRET);
  if (!url || !key) {
    return NextResponse.json({ hasUrl: Boolean(url), hasServiceKey: Boolean(key), cronSecretSet });
  }
  try {
    const response = await fetch(`${url}/rest/v1/player_snapshots?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store'
    });
    const bodySnippet = (await response.text()).slice(0, 300);
    return NextResponse.json({
      hasUrl: true,
      hasServiceKey: true,
      cronSecretSet,
      supabaseStatus: response.status,
      supabaseOk: response.ok,
      bodySnippet
    });
  } catch (error) {
    return NextResponse.json({ hasUrl: true, hasServiceKey: true, cronSecretSet, fetchError: String(error) });
  }
}
