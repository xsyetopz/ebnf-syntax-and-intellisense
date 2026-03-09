import {
  type Disposable,
  type FileSystemWatcher,
  type Uri,
  workspace,
} from "vscode";
import { type ParseOptions, parse, buildSymbolTable } from "./parser";
import type { Rule, SymbolTable } from "./types";

interface IndexedFile {
  uri: Uri;
  rules: Rule[];
  symbolTable: SymbolTable;
}

export interface IndexedRule {
  uri: Uri;
  rule: Rule;
}

export class WorkspaceIndex implements Disposable {
  private index = new Map<string, IndexedRule[]>();
  private fileToNames = new Map<string, Set<string>>();
  private fileData = new Map<string, IndexedFile>();
  private watcher: FileSystemWatcher | undefined;

  async initialize(): Promise<void> {
    const files = await workspace.findFiles("**/*.{ebnf,bnf}");
    await Promise.all(files.map((uri) => this.indexFile(uri)));

    this.watcher = workspace.createFileSystemWatcher("**/*.{ebnf,bnf}");
    this.watcher.onDidCreate((uri) => this.indexFile(uri));
    this.watcher.onDidChange((uri) => this.reindexFile(uri));
    this.watcher.onDidDelete((uri) => this.removeFile(uri));
  }

  private async indexFile(uri: Uri): Promise<void> {
    try {
      const content = await workspace.fs.readFile(uri);
      const text = new TextDecoder().decode(content);
      const config = workspace.getConfiguration("ebnf");
      const options: ParseOptions = {
        spacedIdentifiers: config.get<boolean>("parser.spacedIdentifiers", false),
      };
      const doc = parse(text, options);
      const symbolTable = buildSymbolTable(doc);

      const uriStr = uri.toString();
      const names = new Set<string>();

      for (const rule of doc.rules) {
        names.add(rule.name);
        const existing = this.index.get(rule.name) ?? [];
        existing.push({ uri, rule });
        this.index.set(rule.name, existing);
      }

      this.fileToNames.set(uriStr, names);
      this.fileData.set(uriStr, { uri, rules: doc.rules, symbolTable });
    } catch {
      // File might not exist or be readable
    }
  }

  private async reindexFile(uri: Uri): Promise<void> {
    this.removeFile(uri);
    await this.indexFile(uri);
  }

  private removeFile(uri: Uri): void {
    const uriStr = uri.toString();
    const names = this.fileToNames.get(uriStr);
    if (names) {
      for (const name of names) {
        const entries = this.index.get(name);
        if (entries) {
          const filtered = entries.filter((e) => e.uri.toString() !== uriStr);
          if (filtered.length > 0) {
            this.index.set(name, filtered);
          } else {
            this.index.delete(name);
          }
        }
      }
      this.fileToNames.delete(uriStr);
    }
    this.fileData.delete(uriStr);
  }

  findDefinitions(name: string): IndexedRule[] {
    return this.index.get(name) ?? [];
  }

  getFileData(uriStr: string): IndexedFile | undefined {
    return this.fileData.get(uriStr);
  }

  getAllFiles(): IndexedFile[] {
    return Array.from(this.fileData.values());
  }

  searchSymbols(query: string): IndexedRule[] {
    const results: IndexedRule[] = [];
    const lowerQuery = query.toLowerCase();
    for (const [name, entries] of this.index) {
      if (name.toLowerCase().includes(lowerQuery)) {
        results.push(...entries);
      }
    }
    return results;
  }

  dispose(): void {
    this.watcher?.dispose();
  }
}
