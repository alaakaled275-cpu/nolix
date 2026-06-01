import { query } from "./db";
import { logger } from "./nolix-structured-logger";

interface BaselineFeatures {
    sessionDurationMs: number;
    pagesViewed: number;
    scrollDepth: number;
    source: string;
    device: string;
    intentScore: number;
}

export async function predictBaselineProbability(storeDomain: string, features: BaselineFeatures): Promise<number> {
    try {
        // Fetch learned model parameters from DB
        const modelData = await query<{ feature_weights: any, intercept: number }>(`
            SELECT feature_weights, intercept 
            FROM bic_baseline_model 
            WHERE store_domain = $1 
            ORDER BY trained_at DESC LIMIT 1
        `, [storeDomain]);

        // Default heuristic weights if no learned model exists yet
        let w_duration = 0.0001;
        let w_pages = 0.05;
        let w_intent = 0.01;
        let intercept = -3.5; // Starts with a low base probability ~3%

        if (modelData && modelData.length > 0) {
            const weights = modelData[0].feature_weights;
            intercept = Number(modelData[0].intercept);
            w_duration = Number(weights.duration) || 0;
            w_pages = Number(weights.pages) || 0;
            w_intent = Number(weights.intent) || 0;
        }

        // Logistic Regression Formula: P = 1 / (1 + e^-z)
        // z = w1*x1 + w2*x2 + ... + intercept
        
        const durationSecs = features.sessionDurationMs / 1000;
        let z = intercept 
              + (w_duration * durationSecs)
              + (w_pages * features.pagesViewed)
              + (w_intent * features.intentScore);

        // Device multiplier (one-hot approximation)
        if (features.device === 'desktop') z += 0.2;
        if (features.source === 'ads') z -= 0.1;

        const p = 1 / (1 + Math.exp(-z));
        
        return Math.max(0.001, Math.min(0.999, p)); // Bound between 0.1% and 99.9%
    } catch (e: any) {
        logger.error("bic", "Baseline Prediction Failed", { error: e.message }).catch(() => {});
        return 0.02; // Global default 2%
    }
}
