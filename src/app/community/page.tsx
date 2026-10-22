import { CommunityDashboard } from "@components/community/CommunityDashboard";
import { getRequestIdentity } from "@server/authService";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const identity = await getRequestIdentity();
  return <CommunityDashboard signedIn={identity.kind === "user"} />;
}
