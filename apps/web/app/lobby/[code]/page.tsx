import { LobbyClient } from '../../decoy-client';

export default async function LobbyPage({
  params
}: {
  params: Promise<{ code: string }>;
}) {
  const resolved = await params;
  return <LobbyClient code={resolved.code} />;
}
