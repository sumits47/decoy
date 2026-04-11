import { getLobbySnapshot } from '@decoy/backend';
import { NextResponse } from 'next/server';

export async function GET(_: Request, context: { params: Promise<{ lobbyId: string }> }) {
  try {
    const { lobbyId } = await context.params;
    return NextResponse.json(getLobbySnapshot(lobbyId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 404 });
  }
}
