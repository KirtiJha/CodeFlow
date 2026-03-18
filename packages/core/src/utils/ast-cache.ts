import { LRUCache } from "lru-cache";
import type Parser from "tree-sitter";

export interface CacheEntry {
  tree: Parser.Tree;
  contentHash: string;
  parsedAt: number;
}

export interface ASTCacheOptions {
  maxEntries?: number;
  maxByteSize?: number;
}

const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_MAX_BYTE_SIZE = 256 * 1024 * 1024; // 256 MB

export class ASTCache {
  private readonly cache: LRUCache<string, CacheEntry>;
  private totalByteEstimate = 0;
  private readonly maxByteSize: number;

  constructor(options: ASTCacheOptions = {}) {
    this.maxByteSize = options.maxByteSize ?? DEFAULT_MAX_BYTE_SIZE;
    this.cache = new LRUCache<string, CacheEntry>({
      max: options.maxEntries ?? DEFAULT_MAX_ENTRIES,
      dispose: (_value, _key) => {
        // Approximate byte reclaim
        this.totalByteEstimate = Math.max(
          0,
          this.totalByteEstimate - this.estimateTreeSize(_value),
        );
      },
    });
  }

  get(filePath: string, contentHash: string): Parser.Tree | null {
    const entry = this.cache.get(filePath);
    if (entry && entry.contentHash === contentHash) {
      return entry.tree;
    }
    if (entry) {
      this.cache.delete(filePath);
    }
    return null;
  }

  set(filePath: string, tree: Parser.Tree, contentHash: string): void {
    const byteEstimate = this.estimateTreeSize({
      tree,
      contentHash,
      parsedAt: 0,
    });

    // Evict until we have room
    while (
      this.totalByteEstimate + byteEstimate > this.maxByteSize &&
      this.cache.size > 0
    ) {
      // LRU eviction — pop the least recently used
      const oldest = this.lruKey();
      if (oldest) this.cache.delete(oldest);
      else break;
    }

    this.cache.set(filePath, {
      tree,
      contentHash,
      parsedAt: Date.now(),
    });
    this.totalByteEstimate += byteEstimate;
  }

  has(filePath: string): boolean {
    return this.cache.has(filePath);
  }

  delete(filePath: string): void {
    this.cache.delete(filePath);
  }

  clear(): void {
    this.cache.clear();
    this.totalByteEstimate = 0;
  }

  get size(): number {
    return this.cache.size;
  }

  get estimatedBytes(): number {
    return this.totalByteEstimate;
  }

  private estimateTreeSize(entry: CacheEntry): number {
    // Rough estimate: tree node count × average node size
    try {
      const root = entry.tree.rootNode;
      return root.endIndex * 2; // ~2 bytes per source byte for tree overhead
    } catch {
      return 4096; // fallback
    }
  }

  private lruKey(): string | undefined {
    // LRUCache iterates in LRU order (least recently used first)
    for (const key of this.cache.keys()) {
      return key;
    }
    return undefined;
  }
}
