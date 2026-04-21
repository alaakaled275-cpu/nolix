import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAccessTier, requireTier } from "@/lib/nolix-security";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-nolix-key");
  if (!requireTier(getAccessTier(key), "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, variants } = await req.json();
    if (!name || !variants || variants.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const experimentId = name.toLowerCase().replace(/[^a-z0-9]/g, "_");

    await query(
      `INSERT INTO nolix_experiments (id, name, status, start_date) VALUES ($1, $2, 'active', NOW())`,
      [experimentId, name]
    );

    for (const v of variants) {
      await query(
        `INSERT INTO nolix_experiment_variants (id, experiment_id, name, config, traffic_allocation) VALUES ($1, $2, $3, $4, $5)`,
        [`${experimentId}_${v.name}`, experimentId, v.name, JSON.stringify(v.config), v.traffic_allocation || (1.0 / variants.length)]
      );
    }

    return NextResponse.json({ success: true, experiment_id: experimentId });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to create experiment", message: err.message }, { status: 500 });
  }
}
