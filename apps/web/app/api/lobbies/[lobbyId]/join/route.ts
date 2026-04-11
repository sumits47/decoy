import { joinLobby } from '@decoy/backend';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string; displayName?: string };
    return NextResponse.json(joinLobby({ code: body.code ?? '', displayName: body.displayName ?? 'Player' }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
