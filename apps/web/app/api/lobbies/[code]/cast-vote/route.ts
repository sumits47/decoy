import { submitLobbyVote, toErrorResponse } from '@decoy/backend';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const body = (await request.json()) as { playerId?: string; optionId?: string };
    return NextResponse.json({ lobby: submitLobbyVote(code, body.playerId ?? '', body.optionId ?? '') });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
