import { revealLobbyRound, toErrorResponse } from '@decoy/backend';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = (await request.json()) as { playerId?: string };
    const lobby = revealLobbyRound(code, body.playerId ?? '');
    return NextResponse.json({ lobby });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
