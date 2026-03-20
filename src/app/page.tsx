import { ConciergeShell } from "@/components/concierge-shell";
import { listProposals } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
  const initialHistory = listProposals();

  return <ConciergeShell initialHistory={initialHistory} />;
}
