/**
 * NOLIX — Model Registry API (STEP 15 PART 2)
 * app/api/admin/model/registry/route.ts
 *
 * GET  — list all models
 * POST — promote, rollback, compare
 */
import { NextRequest, NextResponse }                  from "next/server";
import { listModels, promoteModel, rollbackModel, compareModels } from "@/lib/nolix-model-registry";
import { getAccessTier, requireTier, checkRateLimit, getClientId, auditLog } from "@/lib/nolix-security";
import { getModelServerStatus }                       from "@/lib/nolix-model-server";

export const dynamic = "force-dynamic";

function auth(req: NextRequest, tier: "read" | "write" | "admin") {
  const key    = req.headers.get("x-nolix-sync-secret") || req.headers.get("x-nolix-key");
  const actual = getAccessTier(key);
  return requireTier(actual, tier) ? actual : null;
}

export async function GET(req: NextRequest) {
  const tier = auth(req, "read");
  if (!tier) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [models, compare, serverStatus] = await Promise.all([
    listModels(20),
    compareModels(),
    Promise.resolve(getModelServerStatus())
  ]);

  return NextResponse.json({ models, compare, server: serverStatus });
}

export async function POST(req: NextRequest) {
  const tier = auth(req, "admin");
  if (!tier) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = getClientId(req);
  const rl = checkRateLimit(clientId, "admin");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body   = await req.json().catch(() => ({}));
  const action = body.action as string;

  let result: any;
  if (action === "promote" && body.version) {
    result = await promoteModel(Number(body.version), `admin:${clientId}`);
    await auditLog("model_promote", clientId, tier, { version: body.version });
  } else if (action === "rollback") {
    result = await rollbackModel(`admin:${clientId}`);
    await auditLog("model_rollback", clientId, tier, {});
  } else if (action === "compare") {
    result = await compareModels();
  } else {
    return NextResponse.json({ error: "Unknown action. Use: promote|rollback|compare" }, { status: 400 });
  }

  return NextResponse.json({ action, result, ok: true });
}
