import { findLobbyByCode } from '@decoy/backend';
import { NextResponse } from 'next/server';

export async function GET(_: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    return NextResponse.json(findLobbyByCode(code));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 404 });
  }
}
