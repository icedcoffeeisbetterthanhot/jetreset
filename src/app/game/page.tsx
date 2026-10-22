import PlaneGame from "../../components/game/PlaneGame";
import { getRequestIdentity } from "@server/authService";

export const dynamic = "force-dynamic";

export default async function GamePage() {
  const identity = await getRequestIdentity();
  return <PlaneGame signedIn={identity.kind === "user"} />;
}
