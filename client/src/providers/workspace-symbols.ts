import {
  type CancellationToken,
  Location,
  SymbolInformation,
  SymbolKind,
  type WorkspaceSymbolProvider,
} from "vscode";
import type { WorkspaceIndex } from "../workspace-index";

export class EbnfWorkspaceSymbolProvider implements WorkspaceSymbolProvider {
  constructor(private readonly index: WorkspaceIndex) {}

  provideWorkspaceSymbols(
    query: string,
    _token: CancellationToken,
  ): SymbolInformation[] {
    if (!query) {
      return [];
    }

    return this.index.searchSymbols(query).map(
      (entry) =>
        new SymbolInformation(
          entry.rule.name,
          SymbolKind.Function,
          "",
          new Location(entry.uri, entry.rule.nameRange),
        ),
    );
  }
}
