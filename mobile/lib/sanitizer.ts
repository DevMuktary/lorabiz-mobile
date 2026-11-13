// mobile/lib/sanitizer.ts

const INTERNAL_NOTE_PATTERNS: RegExp[] = [
  /\bpushed\s+(?:via|to)\b/i,
  /\bquick\s+table\s+action\b/i,
  /\bmds\s+drawer\b/i,
  /\bmanually\s+linked\b/i,
  /\b(?:pushed|sent|routed|dispatched|forwarded|queued|linked)\s+(?:to|via|at|with)\s+(?:ambverify|dataverify|arewasmart|robosttech|abjiktech|agenthub|slipapi|verification gateway)\b/i,
  /\bsubmitted\s+to\s+(?:ambverify|dataverify|arewasmart|robosttech|abjiktech|agenthub|slipapi|gateway|verification gateway)\b/i,
  /\b(?:verification|validation|request|order|application)\s+(?:sent|routed|pushed|dispatched|forwarded)\s+to\s+(?:ambverify|dataverify|arewasmart|robosttech|abjiktech|agenthub|slipapi)\b/i,
  /\bvalidation\s+in\s+progress\s+at\b/i,
];

function scrubProviderBrandText(input: string): string {
  return input
    .replace(/https?:\/\/[^\s]+/gi, "verification gateway")
    .replace(/\bambverify(?:\.com\.ng)?\b/gi, "Verification Gateway")
    .replace(/\bdataverify(?:\.org)?\b/gi, "Verification Gateway")
    .replace(/\barewasmart(?:\.com\.ng)?\b/gi, "Verification Gateway")
    .replace(/\brobosttech(?:\.com)?\b/gi, "Verification Gateway")
    .replace(/\babjiktech(?:\.com)?\b/gi, "Processing Gateway")
    .replace(/\bagenthub\b/gi, "Verification Gateway")
    .replace(/\bslipapi\b/gi, "Verification Gateway")
    .replace(/\s*\(\s*(?:Verification Gateway|Processing Gateway)\s*\)/gi, "")
    .replace(/\bNIMC\s*\/\s*Verification Gateway\b/gi, "Identity Authority")
    .replace(/\bVerification Gateway\s+gateway\b/gi, "Verification Gateway")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isInternalNoteSegment(segment: string): boolean {
  const trimmed = segment.trim();
  if (!trimmed) return true;
  return INTERNAL_NOTE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Removes internal operator routing notes and upstream provider names before
 * rendering processing notes in customer UI cards and modals.
 */
export function sanitizeMobileNote(note?: string | null): string | null {
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  if (!trimmed) return null;

  const segments = trimmed
    .split(/(?:\r?\n|\s*\|\s*)+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && !isInternalNoteSegment(segment));

  if (segments.length === 0) return null;

  const cleaned = segments
    .map((segment) => scrubProviderBrandText(segment))
    .filter((segment) => segment.length > 0 && !isInternalNoteSegment(segment));

  return cleaned.length > 0 ? cleaned.join("\n") : null;
}

/**
 * Sanitizes status or gateway messages displayed to mobile users.
 */
export function sanitizeMobileMessage(
  message?: string | null,
  fallback = ""
): string {
  if (typeof message !== "string" || !message.trim()) {
    return fallback;
  }
  const trimmed = message.trim();
  if (isInternalNoteSegment(trimmed)) {
    return fallback;
  }
  return scrubProviderBrandText(trimmed) || fallback;
}

