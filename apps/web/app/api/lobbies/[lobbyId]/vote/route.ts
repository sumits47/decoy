import { castPlayerVote } from '@decoy/backend';
import { NextResponse } from 'next/server';

export async function POST(request: Request, context: { params: Promise<{ lobbyId: string }> }) {
  try {
    const { lobbyId } = await context.params;
    const body = (await request.json()) as { roundId: string; playerId: string; submissionId: string };
    return NextResponse.json(
      castPlayerVote({ lobbyId, roundId: body.roundId, playerId: body.playerId, submissionId: body.submissionId })
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
