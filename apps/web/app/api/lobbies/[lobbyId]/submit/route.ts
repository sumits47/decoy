import { submitPlayerAnswer } from '@decoy/backend';
import { NextResponse } from 'next/server';

export async function POST(request: Request, context: { params: Promise<{ lobbyId: string }> }) {
  try {
    const { lobbyId } = await context.params;
    const body = (await request.json()) as { roundId: string; playerId: string; text: string };
    return NextResponse.json(submitPlayerAnswer({ lobbyId, roundId: body.roundId, playerId: body.playerId, text: body.text }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
