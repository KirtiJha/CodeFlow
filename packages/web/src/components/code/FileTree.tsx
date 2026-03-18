import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, FileCode, Folder, FolderOpen } from "lucide-react";

interface FileTreeProps {
  files: string[];
  selectedFile?: string;
  onSelect: (file: string) => void;
  className?: string;
}

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  isFile: boolean;
}

export function FileTree({
  files,
  selectedFile,
  onSelect,
  className = "",
}: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);

  return (
    <div className={`overflow-auto text-sm ${className}`}>
      {Array.from(tree.children.entries()).map(([name, node]) => (
        <TreeItem
          key={name}
          node={node}
          depth={0}
          selectedFile={selectedFile}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function TreeItem({
  node,
  depth,
  selectedFile,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedFile?: string;
  onSelect: (file: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isSelected = selectedFile === node.path;
  const hasChildren = node.children.size > 0;

  return (
    <div>
      <button
        onClick={() => {
          if (node.isFile) {
            onSelect(node.path);
          } else {
            setExpanded(!expanded);
          }
        }}
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-bg-elevated ${
          isSelected
            ? "bg-accent-blue/10 text-accent-blue"
            : "text-text-secondary"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {!node.isFile && (
          <motion.div
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight className="h-3 w-3 text-text-muted" />
          </motion.div>
        )}
        {node.isFile ? (
          <FileCode className="h-3.5 w-3.5 flex-shrink-0 text-text-muted" />
        ) : expanded ? (
          <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
        ) : (
          <Folder className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
        )}
        <span className="truncate">{node.name}</span>
      </button>

      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {Array.from(node.children.entries())
              .sort(([, a], [, b]) => {
                if (a.isFile === b.isFile) return a.name.localeCompare(b.name);
                return a.isFile ? 1 : -1;
              })
              .map(([name, child]) => (
                <TreeItem
                  key={name}
                  node={child}
                  depth={depth + 1}
                  selectedFile={selectedFile}
                  onSelect={onSelect}
                />
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function buildTree(files: string[]): TreeNode {
  const root: TreeNode = {
    name: "",
    path: "",
    children: new Map(),
    isFile: false,
  };

  for (const file of files) {
    const parts = file.split("/");
    let current = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: currentPath,
          children: new Map(),
          isFile,
        });
      }
      current = current.children.get(part)!;
    }
  }

  return root;
}
