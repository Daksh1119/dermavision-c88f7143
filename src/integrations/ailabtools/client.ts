import { supabase } from "@/integrations/supabase/client";

export type AILabToolsResult = {
  success: true;
  top1_label: string;
  top1_confidence: number;
  top_predictions: Array<{ label_name: string; confidence: number }>;
  malignant_probability: number;
  malignant_flag: boolean;
  model_version?: string;
};

export async function predictWithAILabTools(imageDataUrl: string) {
  const { data, error } = await supabase.functions.invoke("ailabtools-predict", {
    body: { imageDataUrl },
  });

  if (error) {
    throw new Error(error.message || "Prediction failed");
  }
  if (!data?.success) {
    throw new Error((data as any)?.message || "Vendor prediction failed");
  }
  return data as AILabToolsResult;
}