import { ChunkConfig, TranscriptChunk } from './types';

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  targetChunkSize: 7000,
  overlapSize: 600,
};

const SPEAKER_BOUNDARY_RE =
  /\n(?=(?:Management|Analyst|Moderator|Operator|Questioner|[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)?)(?:\s*[-–]\s*[A-Za-z ]+)?:)/;

export function chunkTranscript(
  text: string,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): TranscriptChunk[] {
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
      const searchRegion = trimmedText.slice(Math.max(currentStart, currentEnd - 1000), currentEnd);

      const speakerMatch = searchRegion.search(SPEAKER_BOUNDARY_RE);
      if (speakerMatch !== -1) {
        currentEnd = Math.max(currentStart, currentEnd - 1000 + speakerMatch);
      } else {
        const paragraphMatch = searchRegion.lastIndexOf('\n\n');
        if (paragraphMatch !== -1) {
          currentEnd = Math.max(currentStart, currentEnd - 1000 + paragraphMatch + 2);
        } else {
          const sentenceMatch = searchRegion.search(/([.?!])\s+(?=[A-Z])/);
          if (sentenceMatch !== -1) {
            currentEnd = Math.max(currentStart, currentEnd - 1000 + sentenceMatch + 2);
          }
        }
      }
    }

    const chunkText = trimmedText.slice(currentStart, currentEnd).trim();
    if (chunkText.length > 0) {
      rawChunks.push({ startChar: currentStart, endChar: currentEnd, text: chunkText });
    }

    if (currentEnd >= trimmedText.length) break;
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
