const PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: 'creditCard', pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g },
  { name: 'ipAddress', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g },
  { name: 'phone', pattern: /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g },
];

export function redactPII(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { pattern } of PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

export function redactAndPreview(text: string, maxLen = 200): string {
  const redacted = redactPII(text ?? '');
  return redacted.length > maxLen ? redacted.slice(0, maxLen) + '…' : redacted;
}
