/**
 * NOLIX — Cron: Model training (STEP 15 PART 8)
 * app/api/cron/train/route.ts
 */
import { NextRequest, NextResponse }       from "next/server";
import { trainBatch, getModelState, saveModelToDB } from "@/lib/nolix-ml-engine";
import { trainGBT }                        from "@/lib/nolix-advanced-models";
import { registerModel }                   from "@/lib/nolix-model-registry";
import { getBatchForTraining }             from "@/lib/nolix-feature-store-v2";
import { getRuntimeFlag }                  from "@/lib/nolix-runtime";
import { logMetric }                       from "@/lib/nolix-metrics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.NOLIX_CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trainingEnabled = await getRuntimeFlag("training_enabled").catch(() => true);
  if (!trainingEnabled) return NextResponse.json({ ok: false, reason: "training_enabled=false" });

  await logMetric("cron_train_start", 1, {}).catch(() => {});

  // LR Full retrain
  let lrResult: any = null;
  let registry:  any = null;
  let gbtResult: any = null;

  try {
    const result = await trainBatch();
    lrResult = { auc: result.auc, samples: result.samples, val_loss: result.val_loss };

    if (result.samples >= 10) {
      const state    = getModelState();
      const dataset  = await getBatchForTraining(2000);
      const reg = await registerModel({
        weights: state.weights, bias: state.bias,
        auc: result.auc, drift: state.drift_score || 0,
        train_samples: result.samples, val_loss: result.val_loss,
        feature_stats: { mean: new Array(8).fill(0), variance: new Array(8).fill(1) }
      }, "cron:train");
      registry = reg;

      await saveModelToDB();

      // GBT every 6h — check hour
      const hour = new Date().getHours();
      if (hour % 6 === 0 && dataset.length >= 20) {
        const gbt = await trainGBT(dataset, { n_estimators: 50 }).catch(() => null);
        if (gbt) gbtResult = { auc: gbt.auc, trees: gbt.n_estimators };
      }
    }
    await logMetric("cron_train_complete", result.auc, {}).catch(() => {});
  } catch(e) {
    await logMetric("cron_train_error", 1, { error: String(e) }).catch(() => {});
    return NextResponse.json({ ok: false, error: String(e) });
  }

  return NextResponse.json({ ok: true, lr: lrResult, registry, gbt: gbtResult, ran_at: new Date().toISOString() });
}
