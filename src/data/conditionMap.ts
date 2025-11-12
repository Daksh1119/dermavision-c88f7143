/**
 * Human-friendly names for model classes.
 * IMPORTANT: Replace the sample mappings with your real dataset mappings.
 * Keys are case-insensitive; "Class_17" and "class_17" are treated the same.
 */
const RAW_CLASS_TO_NAME: Record<string, string> = {
  // ---- SAMPLE MAPPINGS (replace with your real ones) ----
  Class_17: "Seborrheic keratosis",
  Class_37: "Atopic dermatitis (eczema)",
  Class_40: "Psoriasis",
  Class_9: "Acne vulgaris",
  Class_1: "Benign melanocytic nevus",
  // ------------------------------------------------------
};

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizeKey(k: string) {
  return k.trim().toLowerCase();
}

// Build a case-insensitive map
const CLASS_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(RAW_CLASS_TO_NAME).map(([k, v]) => [normalizeKey(k), v])
);

/**
 * Returns a readable name for patients. If unknown:
 * - "Class_17" -> "Condition 17"
 * - "seborrheic_keratosis" -> "Seborrheic Keratosis"
 */
export function getConditionName(label: string): string {
  const key = normalizeKey(label);
  if (CLASS_TO_NAME[key]) return CLASS_TO_NAME[key];

  const m = /^class[\s_-]?(\d+)$/i.exec(label.trim());
  if (m) return `Condition ${m[1]}`;

  // Generic beautification: replace underscores/hyphens and Title-case
  return titleCase(label.replace(/^class[\s_-]?/i, "").replace(/\s+/g, " "));
}

/**
 * Returns the best name to query external info providers.
 * If we have a mapping -> use mapped disease name.
 * If not -> return the original label (the insight layer will fallback safely).
 */
export function getConditionNameForInsights(label: string): string {
  const key = normalizeKey(label);
  return CLASS_TO_NAME[key] ?? label;
}