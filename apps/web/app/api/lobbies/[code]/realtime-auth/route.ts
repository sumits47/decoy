import { createLobbyRealtimeTokenRequest, toErrorResponse } from '@decoy/backend';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(_: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const tokenRequest = await createLobbyRealtimeTokenRequest(code);
    return NextResponse.json(tokenRequest, {
      headers: {
        'cache-control': 'no-store'
      }
    });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
