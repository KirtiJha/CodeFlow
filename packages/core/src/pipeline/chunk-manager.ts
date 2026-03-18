import { readFile, stat } from "node:fs/promises";
import { createLogger } from "../utils/logger.js";

const log = createLogger("pipeline:chunk");

export interface FileChunk {
  files: Array<{
    path: string;
    content: string;
    language: string;
    sizeBytes: number;
  }>;
  totalBytes: number;
}

export interface ChunkConfig {
  byteBudget: number; // Max bytes per chunk (default: 20MB)
  maxFileSize: number; // Skip files larger than this (default: 512KB)
}

const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  byteBudget: 20 * 1024 * 1024, // 20MB
  maxFileSize: 512 * 1024, // 512KB
};

/**
 * Groups files into byte-budgeted chunks for parallel dispatch to workers.
 */
export class ChunkManager {
  private readonly config: ChunkConfig;

  constructor(config?: Partial<ChunkConfig>) {
    this.config = { ...DEFAULT_CHUNK_CONFIG, ...config };
  }

  /**
   * Read files and group them into chunks respecting byte budget.
   */
  async createChunks(
    filePaths: Array<{ path: string; language: string }>,
  ): Promise<FileChunk[]> {
    const chunks: FileChunk[] = [];
    let currentChunk: FileChunk = { files: [], totalBytes: 0 };

    let skipped = 0;
    let processed = 0;

    for (const { path, language } of filePaths) {
      try {
        const fileStat = await stat(path);

        if (fileStat.size > this.config.maxFileSize) {
          skipped++;
          continue;
        }

        const content = await readFile(path, "utf-8");
        const sizeBytes = fileStat.size;

        // Start new chunk if current would exceed budget
        if (
          currentChunk.totalBytes + sizeBytes > this.config.byteBudget &&
          currentChunk.files.length > 0
        ) {
          chunks.push(currentChunk);
          currentChunk = { files: [], totalBytes: 0 };
        }

        currentChunk.files.push({ path, content, language, sizeBytes });
        currentChunk.totalBytes += sizeBytes;
        processed++;
      } catch (err) {
        log.warn({ path, err }, "Failed to read file for chunking");
      }
    }

    // Push the last chunk
    if (currentChunk.files.length > 0) {
      chunks.push(currentChunk);
    }

    log.info(
      { chunks: chunks.length, files: processed, skipped },
      "Created file chunks",
    );

    return chunks;
  }
}
