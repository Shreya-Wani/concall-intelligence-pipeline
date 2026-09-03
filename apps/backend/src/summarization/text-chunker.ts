import { ChunkConfig, TranscriptChunk } from './types';

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  targetChunkSize: 7000,
  overlapSize: 600,
};

export function chunkTranscript(text: string, config: ChunkConfig = DEFAULT_CHUNK_CONFIG): TranscriptChunk[] {
  const trimmedText = text.trim();
  if (!trimmedText) return [];

  const { targetChunkSize, overlapSize } = config;

  if (trimmedText.length <= targetChunkSize) {
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        startChar: 0,
        endChar: trimmedText.length,
        text: trimmedText,
      },
    ];
  }

  const rawChunks: { startChar: number; endChar: number; text: string }[] = [];
  let currentStart = 0;

  while (currentStart < trimmedText.length) {
    let currentEnd = Math.min(currentStart + targetChunkSize, trimmedText.length);

    if (currentEnd < trimmedText.length) {
      // Find optimal split boundary in preference order: speaker block -> paragraph -> sentence
      const searchRegion = trimmedText.slice(Math.max(currentStart, currentEnd - 1000), currentEnd);

      // 1. Speaker block boundary check (e.g. "\nManagement:", "\nAnalyst:", "\n[Name]:")
      const speakerMatch = searchRegion.search(/\n(?=(Management|Analyst|[A-Z][a-z]+ [A-Z][a-z]+):)/);
      if (speakerMatch !== -1) {
        currentEnd = Math.max(currentStart, currentEnd - 1000 + speakerMatch);
      } else {
        // 2. Paragraph boundary check (\n\n)
        const paragraphMatch = searchRegion.lastIndexOf('\n\n');
        if (paragraphMatch !== -1) {
          currentEnd = Math.max(currentStart, currentEnd - 1000 + paragraphMatch + 2);
        } else {
          // 3. Sentence boundary check (. / ? / !)
          const sentenceMatch = searchRegion.search(/([.?!])\s+(?=[A-Z])/);
          if (sentenceMatch !== -1) {
            currentEnd = Math.max(currentStart, currentEnd - 1000 + sentenceMatch + 2);
          }
        }
      }
    }

    const chunkText = trimmedText.slice(currentStart, currentEnd).trim();
    if (chunkText.length > 0) {
      rawChunks.push({
        startChar: currentStart,
        endChar: currentEnd,
        text: chunkText,
      });
    }

    if (currentEnd >= trimmedText.length) break;

    // Advance start position accounting for overlap
    currentStart = Math.max(currentStart + 1, currentEnd - overlapSize);
  }

  const totalChunks = rawChunks.length;
  return rawChunks.map((chunk, idx) => ({
    chunkIndex: idx,
    totalChunks,
    startChar: chunk.startChar,
    endChar: chunk.endChar,
    text: chunk.text,
  }));
}
