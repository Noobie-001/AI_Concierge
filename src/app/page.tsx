import { ConciergeShell } from "@/components/concierge-shell";
import { listProposals } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialHistory = await listProposals();

  return <ConciergeShell initialHistory={initialHistory} />;
}
