import { NextRequest } from 'next/server';
import { POST as createSnapshot } from '../../history/snapshot/route';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  return createSnapshot(request);
}
