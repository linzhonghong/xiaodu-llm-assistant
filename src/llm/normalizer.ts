export function normalizeForTts(input: string, maxChars?: number): string {
  let text = input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)、]\s+/gm, '')
    .replace(/[*_~>#|]/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    text = '我暂时没有想好怎么回答。';
  }

  if (maxChars && text.length > maxChars) {
    text = `${text.slice(0, maxChars).trim()}要不要我继续说？`;
  }

  return text;
}
