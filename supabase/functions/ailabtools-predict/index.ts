/**
 * Supabase Edge Function: ailabtools-predict
 *
 * Minimal version without remote type references (prevents VSCode TS lib errors).
 * Provides an ambient declaration for Deno so the TypeScript server stops complaining.
 *
 * Deployment:
 *   supabase functions deploy ailabtools-predict
 * Local dev:
 *   supabase functions serve --env-file ./supabase/.env
 *
 * Required secret:
 *   AILABTOOLS_API_KEY
 */

// Ambient Deno type (only for editor convenience; runtime already has Deno).
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

// Config
const API_KEY = Deno.env.get("AILABTOOLS_API_KEY") || "";
// Verify endpoint with AILabTools docs
const AILABTOOLS_ENDPOINT = "https://api.ailabtools.com/ai/skin-disease-detection";

// Types
type VendorCondition = { name: string; probability?: number; score?: number };
type VendorResponse = {
  conditions?: VendorCondition[];
  risk?: { malignant_probability?: number };
};

type AppPrediction = { label_name: string; confidence: number };
interface SuccessBody {
  success: true;
  top1_label: string;
  top1_confidence: number;
  top_predictions: AppPrediction[];
  malignant_probability: number;
  malignant_flag: boolean;
  model_version?: string;
}
interface ErrorBody {
  success: false;
  message: string;
}
type AppResponse = SuccessBody | ErrorBody;

// CORS
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helpers
function json(body: AppResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeVendor(v: VendorResponse): SuccessBody {
  const predictions: AppPrediction[] =
    v.conditions?.map(c => ({
      label_name: c.name,
      confidence: typeof c.probability === "number" ? c.probability : (c.score ?? 0),
    })) || [];

  predictions.sort((a, b) => b.confidence - a.confidence);

  const top = predictions[0] || { label_name: "Unknown", confidence: 0 };
  const malignant_probability = typeof v.risk?.malignant_probability === "number"
    ? v.risk!.malignant_probability
    : 0;

  return {
    success: true,
    top1_label: top.label_name,
    top1_confidence: top.confidence,
    top_predictions: predictions,
    malignant_probability,
    malignant_flag: malignant_probability >= 0.5,
    model_version: "ailabtools-v1",
  };
}

// Handler
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, message: "Method not allowed. Use POST." }, 405);
  }

  try {
    if (!API_KEY) {
      return json({ success: false, message: "Server missing API key" }, 500);
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ success: false, message: "Use application/json body" }, 400);
    }

    const body = await req.json() as {
      imageDataUrl?: string;
      imageBase64?: string;
      age?: number;
      sex?: string;
      body_part?: string;
    };

    const imageDataUrl = body.imageDataUrl;
    const imageBase64 = body.imageBase64;

    if (!imageDataUrl && !imageBase64) {
      return json({ success: false, message: "No image provided" }, 400);
    }

    const rawImage = imageBase64 ||
      (imageDataUrl?.includes(",") ? imageDataUrl.split(",")[1] : imageDataUrl);

    const vendorPayload: Record<string, unknown> = { image: rawImage };
    if (typeof body.age === "number") vendorPayload.age = body.age;
    if (body.sex) vendorPayload.sex = body.sex;
    if (body.body_part) vendorPayload.body_part = body.body_part;

    const vendorRes = await fetch(AILABTOOLS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": API_KEY, // Change to Authorization: Bearer <key> if required by docs
      },
      body: JSON.stringify(vendorPayload),
    });

    if (!vendorRes.ok) {
      const text = await vendorRes.text().catch(() => "");
      return json(
        {
          success: false,
          message: text || `Vendor error (status ${vendorRes.status}). Verify key & payload.`,
        },
        vendorRes.status
      );
    }

    const vendorJson = await vendorRes.json() as VendorResponse;
    const normalized = normalizeVendor(vendorJson);
    return json(normalized, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? "Unknown error");
    return json({ success: false, message }, 500);
  }
});