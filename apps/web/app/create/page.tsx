import { CreateLobbyClient } from '../decoy-client';

export default async function CreatePage({
  searchParams
}: {
  searchParams: Promise<{ host?: string }>;
}) {
  const params = await searchParams;
  return <CreateLobbyClient hostName={params.host ?? 'Host'} />;
}
