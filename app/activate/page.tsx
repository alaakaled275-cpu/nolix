import { cookies } from "next/headers";
import { generateKeys } from "@/lib/nolix-keys";
import ActivateClient from "./ActivateClient";
import { query } from "@/lib/db";

export default async function ActivatePage() {
  const cookieStore = await cookies();
  let workspaceId = cookieStore.get("workspace_id")?.value;
  let publicKey = cookieStore.get("public_key")?.value;

  if (!workspaceId || !publicKey) {
    workspaceId = "ws_" + Math.random().toString(36).substring(2, 10);
    const keys = generateKeys();
    publicKey = keys.public_key;

    // Save mapping to DB
    try {
      await query(`
        INSERT INTO nolix_workspaces (id, name, domain, public_key, secret_key)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [workspaceId, "New Tenant", "auto-generated.local", keys.public_key, keys.secret_key]);
    } catch(e) {
      console.error("DB Save Failed", e);
    }
  }

  return <ActivateClient workspaceId={workspaceId} publicKey={publicKey} />;
}
