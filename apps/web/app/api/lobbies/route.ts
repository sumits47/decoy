import { createLobby } from '@decoy/backend';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { hostName?: string };
    return NextResponse.json(createLobby({ hostName: body.hostName ?? 'Host' }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
