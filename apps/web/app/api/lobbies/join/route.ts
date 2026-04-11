import { joinLobby, toErrorResponse } from '@decoy/backend';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string; name?: string; playerSessionToken?: string };
    const result = joinLobby(body.code ?? '', body.name ?? '', body.playerSessionToken);
    return NextResponse.json(result);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
