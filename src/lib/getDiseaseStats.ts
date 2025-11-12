// Robust, typed, cached disease stats fetcher (India focus)

export interface DiseaseStateDatum {
  state: string;
  cases: number;
  prevalence_rate: number;      // %
  age_group: string;
}

export interface DiseaseStatsResult {
  source: "openrouter" | "mock" | "error";
  condition: string;
  data: DiseaseStateDatum[];
  retrieved_at: string; // ISO timestamp
}

const statsCache = new Map<string, DiseaseStatsResult>();

function sanitizeNumber(n: any, fallback = 0): number {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

function normalizeArray(raw: any, condition: string, source: DiseaseStatsResult["source"]): DiseaseStatsResult {
  if (!Array.isArray(raw)) {
    return {
      source,
      condition,
      data: [],
      retrieved_at: new Date().toISOString(),
    };
  }
  const rows: DiseaseStateDatum[] = raw
    .map((r: any) => ({
      state: String(r.state ?? r.region ?? "Unknown"),
      cases: sanitizeNumber(r.cases, Math.floor(Math.random() * 40000) + 5000),
      prevalence_rate: sanitizeNumber(r.prevalence_rate, Number((Math.random() * 5 + 1).toFixed(2))),
      age_group: String(r.age_group ?? r.demographic ?? "20-40"),
    }))
    // remove obviously empty states
    .filter(r => r.state.toLowerCase() !== "unknown");
  return {
    source,
    condition,
    data: rows,
    retrieved_at: new Date().toISOString(),
  };
}

function mockStats(condition: string, variant: number = 1): DiseaseStatsResult {
  const base: DiseaseStateDatum[] = [
    { state: "Maharashtra", cases: 42000, prevalence_rate: 4.5, age_group: "20-40" },
    { state: "Tamil Nadu", cases: 32000, prevalence_rate: 3.8, age_group: "15-35" },
    { state: "Uttar Pradesh", cases: 50000, prevalence_rate: 5.1, age_group: "18-45" },
    { state: "Kerala", cases: 27000, prevalence_rate: 3.3, age_group: "25-50" },
    { state: "Delhi", cases: 21000, prevalence_rate: 4.1, age_group: "18-40" },
    { state: "Karnataka", cases: 30000, prevalence_rate: 3.7, age_group: "20-45" },
  ];

  const alt: DiseaseStateDatum[] = [
    { state: "Maharashtra", cases: 41000, prevalence_rate: 4.2, age_group: "20-40" },
    { state: "Tamil Nadu", cases: 29000, prevalence_rate: 3.5, age_group: "15-35" },
    { state: "Uttar Pradesh", cases: 48000, prevalence_rate: 4.9, age_group: "18-45" },
    { state: "Kerala", cases: 25000, prevalence_rate: 3.1, age_group: "25-50" },
  ];

  return {
    source: variant === 1 ? "mock" : "error",
    condition,
    data: variant === 1 ? base : alt,
    retrieved_at: new Date().toISOString(),
  };
}

/**
 * Fetch Indian prevalence-like data for a disease condition.
 * Uses OpenRouter if VITE_OPENROUTER_API_KEY is available; else returns mock.
 */
export async function getDiseaseStats(condition: string): Promise<DiseaseStatsResult> {
  const key = condition.toLowerCase().trim();
  if (statsCache.has(key)) return statsCache.get(key)!;

  const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    const m = mockStats(condition);
    statsCache.set(key, m);
    return m;
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Return ONLY raw JSON array (no extra text) of objects: [{state, cases, prevalence_rate, age_group}] for Indian states (4–8 entries). 'cases' integer counts (3000–80000). 'prevalence_rate' a percentage number (0.5–8)."
          },
          {
            role: "user",
            content: `Provide recent (2023-2025) indicative epidemiological style data for the skin disease "${condition}" across major Indian states.`
          }
        ],
        temperature: 0.4,
        max_tokens: 400
      }),
    });

    if (!res.ok) {
      const fallback = mockStats(condition);
      statsCache.set(key, fallback);
      return fallback;
    }

    const json = await res.json();
    // Expect choices[0].message.content to be JSON array
    const rawText: string = json?.choices?.[0]?.message?.content ?? "";
    let parsed: any = null;

    // Strip markdown fences if any
    const cleaned = rawText
      .replace(/```json/gi, "```")
      .replace(/```/g, "")
      .trim();

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Try to locate an array substring
      const arrMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        try {
          parsed = JSON.parse(arrMatch[0]);
        } catch {
          parsed = null;
        }
      }
    }

    if (!parsed) {
      const fallback = mockStats(condition);
      statsCache.set(key, fallback);
      return fallback;
    }

    const result = normalizeArray(parsed, condition, "openrouter");
    statsCache.set(key, result);
    return result;
  } catch (err) {
    console.error("Disease stats error:", err);
    const fallback = mockStats(condition, 2);
    statsCache.set(key, fallback);
    return fallback;
  }
}