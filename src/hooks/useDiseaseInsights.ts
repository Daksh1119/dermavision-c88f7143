import { useEffect, useState } from "react";
import { getSkinDiseaseInfo, DiseaseInfo } from "@/lib/getSkinDiseaseInfo";

interface DiseaseInsightsState {
  info: DiseaseInfo | null;
  loadingInfo: boolean;
  errorInfo: string | null;
}

/**
 * Fetch only condition information for a label/disease.
 * (India prevalence removed from project.)
 */
export function useDiseaseInsights(condition?: string | null) {
  const [state, setState] = useState<DiseaseInsightsState>({
    info: null,
    loadingInfo: false,
    errorInfo: null,
  });

  useEffect(() => {
    if (!condition) return;

    let cancelled = false;

    async function run() {
      setState(prev => ({ ...prev, loadingInfo: true, errorInfo: null }));
      try {
        const info = await getSkinDiseaseInfo(condition);
        if (cancelled) return;
        setState({ info, loadingInfo: false, errorInfo: null });
      } catch (err: any) {
        if (cancelled) return;
        setState({ info: null, loadingInfo: false, errorInfo: "Failed to load disease info" });
      }
    }

    run();
    return () => { cancelled = true; };
  }, [condition]);

  return state;
}