const DEFAULT_SIZE = 1000;
const DEFAULT_OVERLAP = 150;

/**
 * Splits text into overlapping chunks, preferring paragraph boundaries so a
 * chunk rarely cuts mid-thought. Paragraphs longer than `size` are hard-sliced.
 */
export function chunkText(
  text: string,
  size = DEFAULT_SIZE,
  overlap = DEFAULT_OVERLAP,
): string[] {
  const normalised = text.replace(/\r\n/g, "\n").trim();
  if (!normalised) return [];

  const paragraphs = normalised
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const push = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
  };

  for (const paragraph of paragraphs) {
    for (const piece of splitLongParagraph(paragraph, size, overlap)) {
      if (!current) {
        current = piece;
        continue;
      }

      if (current.length + piece.length + 2 <= size) {
        current += `\n\n${piece}`;
        continue;
      }

      push();
      current = `${current.slice(-overlap)}\n\n${piece}`;
    }
  }

  push();
  return chunks;
}

/** Hard-slices a paragraph that is on its own too large to fit in one chunk. */
function splitLongParagraph(paragraph: string, size: number, overlap: number): string[] {
  if (paragraph.length <= size) return [paragraph];

  const pieces: string[] = [];
  const step = Math.max(size - overlap, 1);

  for (let start = 0; start < paragraph.length; start += step) {
    pieces.push(paragraph.slice(start, start + size));
    if (start + size >= paragraph.length) break;
  }

  return pieces;
}
