import { JoinLobbyClient } from '../decoy-client';

export default async function JoinPage({
  searchParams
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  return <JoinLobbyClient initialCode={params.code ?? ''} />;
}
