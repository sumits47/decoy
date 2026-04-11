import { startGame } from '@decoy/backend';
import { NextResponse } from 'next/server';

export async function POST(request: Request, context: { params: Promise<{ lobbyId: string }> }) {
  try {
    const { lobbyId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { archetype?: 'bluff_trivia' | 'opinion_vote' };
    return NextResponse.json(startGame({ lobbyId, archetype: body.archetype }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
