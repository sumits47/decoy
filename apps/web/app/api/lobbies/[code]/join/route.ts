import { joinLobby, toErrorResponse } from '@decoy/backend';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = (await request.json()) as { name?: string };
    const result = joinLobby(code, body.name ?? '');
    return NextResponse.json({ player: 'player' in result ? result.player : result });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
