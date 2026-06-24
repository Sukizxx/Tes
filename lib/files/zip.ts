export interface ZipEntry {
  path: string;
  size: number;
  isDir: boolean;
}

export interface ZipAnalysis {
  /** ASCII tree of the archive. */
  tree: string;
  /** Concatenated text content of readable source files (truncated). */
  content: string;
  fileCount: number;
}

const TEXT_EXT =
  /\.(txt|md|js|jsx|ts|tsx|json|html|htm|css|scss|py|php|go|rs|java|c|h|cpp|cc|cs|rb|sh|bash|yml|yaml|sql|xml|toml|ini|env|gitignore|vue|svelte|kt|swift|dart|lua|r|pl|m)$/i;

const MAX_TOTAL_CONTENT = 60_000; // chars sent to the model
const MAX_FILE_CONTENT = 8_000;

/** Build a nested ASCII tree from a flat list of paths. */
function buildTree(paths: string[]): string {
  type Node = { children: Map<string, Node>; isFile: boolean };
  const root: Node = { children: new Map(), isFile: false };

  for (const p of paths) {
    const parts = p.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, idx) => {
      if (!node.children.has(part)) {
        node.children.set(part, { children: new Map(), isFile: false });
      }
      node = node.children.get(part)!;
      if (idx === parts.length - 1 && !p.endsWith("/")) node.isFile = true;
    });
  }

  const lines: string[] = [];
  const walk = (node: Node, prefix: string) => {
    const entries = [...node.children.entries()].sort((a, b) => {
      // directories first, then alphabetical
      const ad = a[1].isFile ? 1 : 0;
      const bd = b[1].isFile ? 1 : 0;
      if (ad !== bd) return ad - bd;
      return a[0].localeCompare(b[0]);
    });
    entries.forEach(([name, child], i) => {
      const last = i === entries.length - 1;
      const branch = last ? "└── " : "├── ";
      lines.push(prefix + branch + name + (child.isFile ? "" : "/"));
      walk(child, prefix + (last ? "    " : "│   "));
    });
  };
  walk(root, "");
  return lines.join("\n");
}

/** Analyze a ZIP archive: tree + readable source content. */
export async function analyzeZip(data: Uint8Array): Promise<ZipAnalysis> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(data);

  const paths: string[] = [];
  const contentParts: string[] = [];
  let total = 0;
  let fileCount = 0;

  const files = Object.values(zip.files);
  for (const entry of files) {
    paths.push(entry.dir ? entry.name : entry.name);
    if (entry.dir) continue;
    fileCount++;
    // Skip noise.
    if (/node_modules\/|\.git\/|dist\/|build\/|\.(png|jpe?g|gif|webp|ico|woff2?|ttf|mp4|zip|lock)$/i.test(entry.name)) {
      continue;
    }
    if (!TEXT_EXT.test(entry.name)) continue;
    if (total >= MAX_TOTAL_CONTENT) continue;
    try {
      let text = await entry.async("string");
      if (text.length > MAX_FILE_CONTENT) {
        text = text.slice(0, MAX_FILE_CONTENT) + "\n[... truncated ...]";
      }
      const block = `\n### ${entry.name}\n\`\`\`\n${text}\n\`\`\`\n`;
      total += block.length;
      contentParts.push(block);
    } catch {
      /* skip unreadable */
    }
  }

  return {
    tree: buildTree(paths),
    content: contentParts.join("\n").slice(0, MAX_TOTAL_CONTENT),
    fileCount,
  };
}
