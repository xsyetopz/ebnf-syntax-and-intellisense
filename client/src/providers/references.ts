import {
	type CancellationToken,
	Location,
	type Position,
	type ReferenceContext,
	type ReferenceProvider,
	type TextDocument,
} from "vscode";
import type { DocumentManager } from "../document-manager";
import type { WorkspaceIndex } from "../workspace-index";
import { getWordLookup } from "./word-at-position";

export class EbnfReferenceProvider implements ReferenceProvider {
	constructor(
		private readonly manager: DocumentManager,
		private readonly workspaceIndex?: WorkspaceIndex,
	) {}

	provideReferences(
		doc: TextDocument,
		position: Position,
		context: ReferenceContext,
		_token: CancellationToken,
	): Location[] | undefined {
		const lookup = getWordLookup(doc, position, this.manager);
		if (!lookup) {
			return undefined;
		}

		const locations: Location[] = [];
		const currentUri = doc.uri.toString();

		if (context.includeDeclaration) {
			const defs = lookup.symbolTable.definitions.get(lookup.word);
			if (defs) {
				for (const rule of defs) {
					locations.push(new Location(doc.uri, rule.nameRange));
				}
			}
		}

		const refs = lookup.symbolTable.references.get(lookup.word);
		if (refs) {
			for (const ref of refs) {
				locations.push(new Location(doc.uri, ref.range));
			}
		}

		// Add cross-file references from workspace index
		if (this.workspaceIndex) {
			for (const file of this.workspaceIndex.getAllFiles()) {
				// Skip current file (already handled above)
				if (file.uri.toString() === currentUri) {
					continue;
				}

				// Include declarations from other files
				if (context.includeDeclaration) {
					const defs = file.symbolTable.definitions.get(lookup.word);
					if (defs) {
						for (const rule of defs) {
							locations.push(new Location(file.uri, rule.nameRange));
						}
					}
				}

				// Include references from other files
				const fileRefs = file.symbolTable.references.get(lookup.word);
				if (fileRefs) {
					for (const ref of fileRefs) {
						locations.push(new Location(file.uri, ref.range));
					}
				}
			}
		}

		return locations.length > 0 ? locations : undefined;
	}
}
