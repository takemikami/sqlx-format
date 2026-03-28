import * as jsBeautify from "js-beautify";
import { format as sqlFormat } from "sql-formatter";
import type { SqlxFormatConfig } from "./config";
import { SyntaxTreeNode, SyntaxTreeNodeType } from "./lexer";

export function formatSqlx(code: string, config: SqlxFormatConfig): string {
	placeholderCounter = 0;
	const tree = SyntaxTreeNode.create(code);
	const result = formatSqlxNode(tree, "", config);
	return postProcess(result);
}

let placeholderCounter = 0;

function formatSqlxNode(node: SyntaxTreeNode, indent: string, config: SqlxFormatConfig): string {
	const { sqlxStatements, javascriptBlocks, innerSqlBlocks } = separateSqlxIntoParts(node.children());

	const formattedJsBlocks = javascriptBlocks.map((block) => {
		const raw = block.concatenate();
		if (isConfigBlock(raw)) {
			return formatConfigBlock(raw, config);
		}
		return formatJavaScript(raw, config);
	});

	const formattedSqlStatements = sqlxStatements.map((statement) => {
		const placeholders: Record<string, SyntaxTreeNode | string> = {};
		const cleanedSql = stripUnformattableText(statement, placeholders).join("");
		const formatted = formatSql(cleanedSql, config);
		return formatEveryLine(replacePlaceholders(formatted, placeholders, config), (line) => `${indent}${line}`);
	});

	const formattedSqlCodeBlocks = innerSqlBlocks.map((block) => {
		const firstChild = block.children()[0];
		if (typeof firstChild !== "string") {
			throw new Error("Expected first child of SQL block to be a string");
		}
		const firstPart = firstChild;
		const upToFirstBrace = firstPart.slice(0, firstPart.indexOf("{") + 1);

		const lastChild = block.children()[block.children().length - 1];
		if (typeof lastChild !== "string") {
			throw new Error("Expected last child of SQL block to be a string");
		}
		const lastPart = lastChild;
		const lastBraceOnwards = lastPart.slice(lastPart.lastIndexOf("}"));

		const innerNode =
			block.children().length === 1
				? new SyntaxTreeNode(SyntaxTreeNodeType.SQL, [
						firstPart.slice(firstPart.indexOf("{") + 1, firstPart.lastIndexOf("}")),
					])
				: new SyntaxTreeNode(SyntaxTreeNodeType.SQL, [
						firstPart.slice(firstPart.indexOf("{") + 1),
						...block.children().slice(1, -1),
						lastPart.slice(0, lastPart.lastIndexOf("}")),
					]);

		return `${upToFirstBrace}\n${formatSqlxNode(innerNode, "  ", config)}\n${lastBraceOnwards}`;
	});

	const parts: string[] = [];
	if (formattedJsBlocks.length > 0) {
		parts.push(formattedJsBlocks.join("\n\n"));
	}
	if (formattedSqlStatements.length > 0) {
		parts.push(formattedSqlStatements.join(`\n\n${indent}---\n\n`));
	}
	if (formattedSqlCodeBlocks.length > 0) {
		parts.push(formattedSqlCodeBlocks.join("\n\n"));
	}

	return `${indent}${parts.join("\n\n").trim()}`;
}

function separateSqlxIntoParts(nodeContents: Array<string | SyntaxTreeNode>) {
	const sqlxStatements: Array<Array<string | SyntaxTreeNode>> = [[]];
	const javascriptBlocks: SyntaxTreeNode[] = [];
	const innerSqlBlocks: SyntaxTreeNode[] = [];

	nodeContents.forEach((child) => {
		if (typeof child !== "string") {
			switch (child.type) {
				case SyntaxTreeNodeType.JAVASCRIPT:
					javascriptBlocks.push(child);
					return;
				case SyntaxTreeNodeType.SQL:
					innerSqlBlocks.push(child);
					return;
				case SyntaxTreeNodeType.SQL_STATEMENT_SEPARATOR:
					sqlxStatements.push([]);
					return;
				default:
					break;
			}
		}
		sqlxStatements[sqlxStatements.length - 1].push(child);
	});

	return { sqlxStatements, javascriptBlocks, innerSqlBlocks };
}

function isConfigBlock(text: string): boolean {
	return text.trimStart().startsWith("config {");
}

function formatConfigBlock(raw: string, config: SqlxFormatConfig): string {
	const indentSize = config.configIndentWidth;

	// Format with js-beautify
	const beautified = jsBeautify.js(raw, {
		indent_size: indentSize,
		preserve_newlines: true,
		max_preserve_newlines: 2,
	});

	// Extract the contents of config { ... }
	const lines = beautified.split("\n");
	const openIdx = lines.findIndex((l) => l.trim().startsWith("config {"));
	const closeIdx = findClosingBraceLineIndex(lines, openIdx);

	if (openIdx < 0 || closeIdx < 0) {
		return beautified;
	}

	const innerLines = lines.slice(openIdx + 1, closeIdx);
	const sorted =
		config.configKeyOrder === false ? innerLines : sortConfigKeys(innerLines, config.configKeyOrder, indentSize);

	const result = [lines.slice(0, openIdx + 1).join("\n"), sorted.join("\n"), lines.slice(closeIdx).join("\n")].join(
		"\n",
	);

	return result;
}

function findClosingBraceLineIndex(lines: string[], openIdx: number): number {
	let depth = 0;
	let foundOpen = false;
	for (let i = openIdx; i < lines.length; i++) {
		const line = lines[i];
		for (let j = 0; j < line.length; j++) {
			const ch = line[j];
			if (ch === '"' || ch === "'") {
				const quote = ch;
				j++;
				while (j < line.length && line[j] !== quote) {
					if (line[j] === "\\") j++;
					j++;
				}
				continue;
			}
			if (ch === "{") {
				depth++;
				foundOpen = true;
			}
			if (ch === "}") depth--;
			if (foundOpen && depth === 0) return i;
		}
	}
	return -1;
}

interface KeySegment {
	key: string;
	lines: string[];
}

function sortConfigKeys(innerLines: string[], keyOrder: string[], indentSize: number): string[] {
	const indent = " ".repeat(indentSize);
	const keyPattern = new RegExp(`^${indent}(\\w+)\\s*:`);
	const segments: KeySegment[] = [];
	let current: KeySegment | null = null;

	for (const line of innerLines) {
		const match = line.match(keyPattern);
		if (match) {
			current = { key: match[1], lines: [line] };
			segments.push(current);
		} else if (current) {
			current.lines.push(line);
		} else {
			// Keep leading blank lines and comments as-is
			segments.push({ key: "", lines: [line] });
		}
	}

	// Handle trailing commas: strip trailing commas from each segment, then re-add after sorting
	for (const seg of segments) {
		if (seg.key === "") continue;
		const lastIdx = seg.lines.length - 1;
		seg.lines[lastIdx] = seg.lines[lastIdx].replace(/,\s*$/, "");
	}

	const keySegments = segments.filter((s) => s.key !== "");
	const nonKeySegments = segments.filter((s) => s.key === "");

	keySegments.sort((a, b) => {
		const aIdx = keyOrder.indexOf(a.key);
		const bIdx = keyOrder.indexOf(b.key);
		const aOrder = aIdx >= 0 ? aIdx : keyOrder.length + keySegments.indexOf(a);
		const bOrder = bIdx >= 0 ? bIdx : keyOrder.length + keySegments.indexOf(b);
		return aOrder - bOrder;
	});

	// Append commas to all segments except the last
	for (let i = 0; i < keySegments.length; i++) {
		const seg = keySegments[i];
		const lastIdx = seg.lines.length - 1;
		if (i < keySegments.length - 1) {
			seg.lines[lastIdx] = `${seg.lines[lastIdx]},`;
		}
	}

	const result: string[] = [];
	for (const seg of nonKeySegments) {
		result.push(...seg.lines);
	}
	for (const seg of keySegments) {
		result.push(...seg.lines);
	}
	return result;
}

function formatJavaScript(text: string, config: SqlxFormatConfig): string {
	return jsBeautify.js(text, {
		indent_size: config.configIndentWidth,
		preserve_newlines: true,
		max_preserve_newlines: 2,
	});
}

function formatSql(sql: string, config: SqlxFormatConfig): string {
	const { language, tabWidth, keywordCase, ...rest } = config.sqlFormatter;
	try {
		return sqlFormat(sql, {
			language: (language || "bigquery") as any,
			tabWidth: tabWidth || 2,
			keywordCase: (keywordCase as "upper" | "lower" | "preserve") || "upper",
			...rest,
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		const firstLine = message.split("\n")[0];
		throw new Error(`SQL parse error: ${firstLine}`);
	}
}

function stripUnformattableText(
	parts: Array<string | SyntaxTreeNode>,
	placeholders: Record<string, SyntaxTreeNode | string>,
): string[] {
	return parts.map((part) => {
		if (typeof part === "string") {
			return part;
		}
		const placeholderId = generatePlaceholderId();
		switch (part.type) {
			case SyntaxTreeNodeType.SQL_LITERAL_STRING:
			case SyntaxTreeNodeType.SQL_LITERAL_MULTILINE_STRING:
			case SyntaxTreeNodeType.JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER: {
				placeholders[placeholderId] = part;
				return placeholderId;
			}
			case SyntaxTreeNodeType.SQL_COMMENT: {
				const commentPlaceholderId = part.concatenate().startsWith("--")
					? `--${placeholderId}`
					: `/*${placeholderId}*/`;
				placeholders[commentPlaceholderId] = part;
				return commentPlaceholderId;
			}
			default:
				return part.concatenate();
		}
	});
}

function generatePlaceholderId(): string {
	placeholderCounter++;
	const random = Math.random().toString(36).substring(2, 10);
	return `_ph${placeholderCounter}_${random}`;
}

function replacePlaceholders(
	formattedSql: string,
	placeholders: Record<string, SyntaxTreeNode | string>,
	config: SqlxFormatConfig,
): string {
	return Object.keys(placeholders).reduce((sql, placeholderId) => {
		const value = placeholders[placeholderId];
		if (typeof value === "string") {
			return sql.replace(placeholderId, () => value);
		}
		return formatPlaceholderInSql(placeholderId, value, sql, config);
	}, formattedSql);
}

function formatPlaceholderInSql(
	placeholderId: string,
	node: SyntaxTreeNode,
	sql: string,
	config: SqlxFormatConfig,
): string {
	const wholeLine = sql.split("\n").find((line) => line.includes(placeholderId));
	if (!wholeLine) {
		return sql;
	}
	const indent = " ".repeat(wholeLine.length - wholeLine.trimStart().length);
	const formatted = formatSqlQueryPlaceholder(node, indent, config);

	if (node.type !== SyntaxTreeNodeType.SQL_COMMENT && !formatted.includes("\n")) {
		return sql.replace(placeholderId, () => formatted.trim());
	}

	if (node.type === SyntaxTreeNodeType.SQL_LITERAL_MULTILINE_STRING) {
		return sql.replace(placeholderId, () => formatted.trim());
	}

	const [before, after] = wholeLine.split(placeholderId);
	const newLines: string[] = [];
	if (before.trim().length > 0) {
		newLines.push(`${indent}${before.trim()}`);
	}
	newLines.push(formatted);
	if (after.trim().length > 0) {
		newLines.push(`${indent}${after.trim()}`);
	}
	return sql.replace(wholeLine, newLines.join("\n"));
}

function formatSqlQueryPlaceholder(node: SyntaxTreeNode, indent: string, config: SqlxFormatConfig): string {
	switch (node.type) {
		case SyntaxTreeNodeType.JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER:
			return formatJavaScriptPlaceholder(node, indent, config);
		case SyntaxTreeNodeType.SQL_LITERAL_STRING:
		case SyntaxTreeNodeType.SQL_COMMENT:
			return formatEveryLine(node.concatenate(), (line) => `${indent}${line.trimStart()}`);
		case SyntaxTreeNodeType.SQL_LITERAL_MULTILINE_STRING:
			return `${indent}${node.concatenate().trimStart()}`;
		default:
			return node.concatenate();
	}
}

function formatJavaScriptPlaceholder(node: SyntaxTreeNode, indent: string, config: SqlxFormatConfig): string {
	const formatted = formatJavaScript(node.concatenate(), config);
	const insideBraces = formatted.slice(formatted.indexOf("{") + 1, formatted.lastIndexOf("}"));
	const finalJs = insideBraces.trim().includes("\n") ? `\${${insideBraces}}` : `\${${insideBraces.trim()}}`;
	return formatEveryLine(finalJs, (line) => `${indent}${line}`);
}

function formatEveryLine(text: string, mapFn: (line: string) => string): string {
	return text.split("\n").map(mapFn).join("\n");
}

function postProcess(text: string): string {
	let previousLineHadContent = false;
	const result = text.split("\n").reduce((acc, line) => {
		const hasContent = line.trim().length > 0;
		if (hasContent) {
			previousLineHadContent = true;
			return `${acc}\n${line.trimEnd()}`;
		}
		if (previousLineHadContent) {
			previousLineHadContent = false;
			return `${acc}\n`;
		}
		return acc;
	}, "");
	return `${result.trim()}\n`;
}
