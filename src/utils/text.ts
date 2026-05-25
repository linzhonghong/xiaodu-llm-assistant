export function firstNonEmpty(values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

export function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

export function nowIso(): string {
  return new Date().toISOString();
}
