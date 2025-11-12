// Structured disease information fetcher with caching & fallback

export interface DiseaseInfo {
  condition: string;
  description: string;
  symptoms: string[];
  causes: string[];
  prevention_treatment: string;
  source: "openrouter" | "fallback" | "error";
  raw?: string;
  retrieved_at: string;
}

const infoCache = new Map<string, DiseaseInfo>();

const FALLBACK_INFO = (condition: string): DiseaseInfo => ({
  condition,
  description:
    "Structured educational information is not available for this label. This may be an internal model class or a rare condition.",
  symptoms: [],
  causes: [],
  prevention_treatment:
    "Consult a licensed dermatologist for personalized evaluation. Maintain general skin hygiene and avoid unverified self-treatment.",
  source: "fallback",
  retrieved_at: new Date().toISOString(),
});

function parseModelMarkdown(text: string, condition: string): DiseaseInfo {
  // Expected format (bold labels). We'll parse line by line robustly.
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const info: DiseaseInfo = {
    condition,
    description: "",
    symptoms: [],
    causes: [],
    prevention_treatment: "",
    source: "openrouter",
    raw: text,
    retrieved_at: new Date().toISOString(),
  };

  const extract = (label: string) =>
    lines.find(l => l.toLowerCase().startsWith(label.toLowerCase())) ?? "";

  const getValueAfterColon = (line: string) => line.split(":").slice(1).join(":").trim();

  const nameLine = extract("**Disease Name**") || extract("Disease Name");
  const descLine = extract("**Description**") || extract("Description");
  const symLine = extract("**Common Symptoms**") || extract("Common Symptoms");
  const causeLine = extract("**Causes**") || extract("Causes");
  const treatLine = extract("**Prevention & Treatment**") || extract("Prevention & Treatment");

  // Condition (if model outputs a different canonical name we could adopt it)
  const nameValue = getValueAfterColon(nameLine);
  info.condition = nameValue || condition;

  info.description = getValueAfterColon(descLine) || FALLBACK_INFO(condition).description;

  const symValue = getValueAfterColon(symLine);
  info.symptoms = symValue
    ? symValue.split(/[,•]/).map(s => s.trim()).filter(Boolean)
    : [];

  const causeValue = getValueAfterColon(causeLine);
  info.causes = causeValue
    ? causeValue.split(/[,•]/).map(s => s.trim()).filter(Boolean)
    : [];

  info.prevention_treatment = getValueAfterColon(treatLine) ||
    FALLBACK_INFO(condition).prevention_treatment;

  return info;
}

export async function getSkinDiseaseInfo(condition: string): Promise<DiseaseInfo> {
  const key = condition.toLowerCase().trim();
  if (infoCache.has(key)) return infoCache.get(key)!;

  const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    const fb = FALLBACK_INFO(condition);
    infoCache.set(key, fb);
    return fb;
  }

  try {
    const prompt = `
You are a dermatology assistant.
Provide information about: "${condition}".
Return EXACTLY in this template (markdown, keep the ** labels):
**Disease Name:** <name>
**Description:** <1–3 sentences>
**Common Symptoms:** <comma-separated>
**Causes:** <comma-separated>
**Prevention & Treatment:** <short paragraph>
If it is not a skin condition, respond EXACTLY: Not a skin-related condition.
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a professional dermatology assistant." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const fb = FALLBACK_INFO(condition);
      infoCache.set(key, fb);
      return fb;
    }

    const data = await response.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim() || "";

    if (!text || text === "Not a skin-related condition.") {
      const fb = FALLBACK_INFO(condition);
      infoCache.set(key, fb);
      return fb;
    }

    const parsed = parseModelMarkdown(text, condition);
    infoCache.set(key, parsed);
    return parsed;
  } catch (err) {
    console.error("Disease info error:", err);
    const fb = { ...FALLBACK_INFO(condition), source: "error" as const };
    infoCache.set(key, fb);
    return fb;
  }
}