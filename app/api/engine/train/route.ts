/**
 * NOLIX — Training Batch API (STEP 15 PART 4 + 8)
 * app/api/engine/train/route.ts
 *
 * POST /api/engine/train
 * { type: "mini_batch" | "full_lr" | "gbt" | "daily" }
 *
 * Triggers training pipeline:
 *   mini_batch → Adagrad 64 samples
 *   full_lr    → LR retrain on all labeled data → register to model registry
 *   gbt        → GBT retrain 2000 samples
 *   daily      → full pipeline reset (LR + GBT + stats reload)
 */
import { NextRequest, NextResponse }        from "next/server";
import { getBatchForTraining, featureMapToVector } from "@/lib/nolix-feature-store-v2";
import { trainGBT, getFeatureImportance }   from "@/lib/nolix-advanced-models";
import { trainBatch as lrTrainBatch, getModelState, saveModelToDB } from "@/lib/nolix-ml-engine";
import { registerModel }                    from "@/lib/nolix-model-registry";
import { getOrchestratorStatus }            from "@/lib/nolix-training-orchestrator";
import { getRuntimeFlag }                   from "@/lib/nolix-runtime";
import { getAccessTier, requireTier, checkRateLimit, getClientId, auditLog } from "@/lib/nolix-security";
import { logMetric }                        from "@/lib/nolix-metrics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key  = req.headers.get("x-nolix-sync-secret") || req.headers.get("x-nolix-key");
  if (!requireTier(getAccessTier(key), "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = getOrchestratorStatus();
  const fi     = getFeatureImportance();

  return NextResponse.json({ orchestrator: status, feature_importance: fi });
}

export async function POST(req: NextRequest) {
  const key      = req.headers.get("x-nolix-sync-secret") || req.headers.get("x-nolix-key");
  const tier     = getAccessTier(key);
  if (!requireTier(tier, "write"))  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = getClientId(req);
  const rl       = checkRateLimit(clientId, "train");
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  // Respect training_enabled flag
  const trainingEnabled = await getRuntimeFlag("training_enabled").catch(() => true);
  if (!trainingEnabled) return NextResponse.json({ error: "TRAINING_DISABLED", ok: false });

  const body = await req.json().catch(() => ({}));
  const type = body.type as string || "full_lr";

  await auditLog("training_triggered", clientId, tier, { type });
  await logMetric("manual_train_trigger", 1, { type }).catch(() => {});

  try {
    if (type === "gbt") {
      const dataset = await getBatchForTraining(2000);
      if (dataset.length < 20) return NextResponse.json({ ok: false, reason: "Insufficient labeled data (<20)" });

      const model = await trainGBT(dataset, { n_estimators: 50, learning_rate: 0.1 });
      if (!model) return NextResponse.json({ ok: false, reason: "GBT training failed" });

      return NextResponse.json({
        ok:              true,
        type:            "gbt",
        trees:           model.n_estimators,
        auc:             model.auc,
        train_samples:   model.train_samples,
        feature_importance: model.feature_importance
      });
    }

    if (type === "full_lr" || type === "daily" || type === "mini_batch") {
      const limit = type === "mini_batch" ? 64 : 2000;
      const result = await lrTrainBatch();

      if (result.samples < 10) {
        return NextResponse.json({ ok: false, reason: `Too few samples: ${result.samples}` });
      }

      // Register to model registry
      const modelState = getModelState();
      const registered = await registerModel({
        weights:       modelState.weights,
        bias:          modelState.bias,
        auc:           result.auc,
        drift:         modelState.drift_score || 0,
        train_samples: result.samples,
        val_loss:      result.val_loss,
        feature_stats: { mean: new Array(8).fill(0), variance: new Array(8).fill(1) }
      }, `manual:${clientId}`);

      await saveModelToDB().catch(() => {});

      // If daily, also run GBT
      let gbtResult = null;
      if (type === "daily") {
        const dataset = await getBatchForTraining(2000);
        if (dataset.length >= 20) {
          gbtResult = await trainGBT(dataset).catch(() => null);
        }
      }

      return NextResponse.json({
        ok:             true,
        type,
        lr_result: {
          auc:          result.auc,
          samples:      result.samples,
          val_loss:     result.val_loss
        },
        registry: {
          version:      registered.version,
          status:       registered.status,
          auto_promoted: registered.auto_promoted
        },
        gbt_result: gbtResult ? {
          auc:    gbtResult.auc,
          trees:  gbtResult.n_estimators
        } : null
      });
    }

    return NextResponse.json({ error: "Unknown type. Use: mini_batch|full_lr|gbt|daily" }, { status: 400 });
  } catch(e: any) {
    console.error("[train] Error:", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
