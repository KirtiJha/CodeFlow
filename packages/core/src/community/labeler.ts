import type { KnowledgeGraph, GraphNode } from "../graph/types.js";
import type { Community } from "./leiden.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("community:labeler");

/**
 * Automatically generates descriptive labels for communities
 * based on the members' names, kinds, and file paths.
 */
export class CommunityLabeler {
  /**
   * Generate labels for all communities.
   */
  labelAll(communities: Community[], graph: KnowledgeGraph): Community[] {
    return communities.map((c) => ({
      ...c,
      label: this.generateLabel(c, graph),
    }));
  }

  /**
   * Generate a label for a single community.
   */
  private generateLabel(community: Community, graph: KnowledgeGraph): string {
    const members = community.nodeIds
      .map((id) => graph.getNode(id))
      .filter((n): n is GraphNode => n !== undefined);

    if (members.length === 0) return "Empty";

    // Strategy 1: Common directory path
    const dirLabel = this.labelByDirectory(members);
    if (dirLabel) return dirLabel;

    // Strategy 2: Dominant class/module name
    const classLabel = this.labelByClass(members);
    if (classLabel) return classLabel;

    // Strategy 3: Common prefix in function names
    const prefixLabel = this.labelByPrefix(members);
    if (prefixLabel) return prefixLabel;

    // Strategy 4: Most common kind
    return this.labelByKind(members);
  }

  private labelByDirectory(members: GraphNode[]): string | null {
    const dirs = members.map((m) => {
      const parts = m.filePath.split("/");
      return parts.slice(0, -1).join("/");
    });

    // Find the most specific shared directory
    const dirCounts = new Map<string, number>();
    for (const dir of dirs) {
      const parts = dir.split("/");
      for (let i = parts.length; i > 0; i--) {
        const segment = parts.slice(0, i).join("/");
        dirCounts.set(segment, (dirCounts.get(segment) ?? 0) + 1);
      }
    }

    // Find the most specific directory that covers >60% of members
    const threshold = members.length * 0.6;
    let bestDir = "";
    let bestDepth = 0;

    for (const [dir, count] of dirCounts) {
      if (count < threshold) continue;
      const depth = dir.split("/").length;
      if (depth > bestDepth) {
        bestDepth = depth;
        bestDir = dir;
      }
    }

    if (bestDir) {
      const lastPart = bestDir.split("/").pop() ?? bestDir;
      return this.capitalize(lastPart);
    }

    return null;
  }

  private labelByClass(members: GraphNode[]): string | null {
    const classes = members.filter(
      (m) =>
        m.kind === "class" || m.kind === "interface" || m.kind === "struct",
    );

    if (classes.length === 1) {
      return classes[0]?.name ?? null;
    }

    if (classes.length > 1) {
      // Find common prefix among class names
      const names = classes.map((c) => c.name);
      const prefix = this.commonPrefix(names);
      if (prefix.length >= 3) {
        return `${prefix}*`;
      }
      return classes[0]?.name ?? null;
    }

    // Check if members share an owner (method group)
    const owners = new Map<string, number>();
    for (const m of members) {
      if (m.ownerId) {
        const owner = members.find((n) => n.id === m.ownerId) ?? {
          name: m.ownerId,
        };
        owners.set(owner.name, (owners.get(owner.name) ?? 0) + 1);
      }
    }

    if (owners.size === 1) {
      return owners.keys().next().value ?? null;
    }

    return null;
  }

  private labelByPrefix(members: GraphNode[]): string | null {
    const names = members
      .filter((m) => m.kind === "function" || m.kind === "method")
      .map((m) => m.name);

    if (names.length < 2) return null;

    const prefix = this.commonPrefix(names);
    if (prefix.length >= 3) {
      return `${this.capitalize(prefix)}*`;
    }

    return null;
  }

  private labelByKind(members: GraphNode[]): string {
    const kindCounts = new Map<string, number>();
    for (const m of members) {
      kindCounts.set(m.kind, (kindCounts.get(m.kind) ?? 0) + 1);
    }

    let dominantKind = "function";
    let maxCount = 0;
    for (const [kind, count] of kindCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominantKind = kind;
      }
    }

    return `${this.capitalize(dominantKind)} Group (${members.length})`;
  }

  private commonPrefix(strings: string[]): string {
    if (strings.length === 0) return "";
    let prefix = strings[0] ?? "";
    for (let i = 1; i < strings.length; i++) {
      const s = strings[i];
      if (!s) continue;
      while (!s.startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
        if (prefix.length === 0) return "";
      }
    }
    return prefix;
  }

  private capitalize(s: string): string {
    if (s.length === 0) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /**
   * Generate a label for a set of node IDs (pipeline helper).
   */
  label(nodeIds: string[], graph: KnowledgeGraph): string {
    const members = nodeIds
      .map((id) => graph.getNode(id))
      .filter((n): n is GraphNode => n !== undefined);
    if (members.length === 0) return "Community";
    return (
      this.labelByDirectory(members) ??
      this.labelByClass(members) ??
      this.labelByPrefix(members) ??
      this.labelByKind(members)
    );
  }
}
