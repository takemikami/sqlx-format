"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatSqlx = formatSqlx;
const jsBeautify = __importStar(require("js-beautify"));
const sql_formatter_1 = require("sql-formatter");
const lexer_1 = require("./lexer");
function formatSqlx(code, config) {
    placeholderCounter = 0;
    const tree = lexer_1.SyntaxTreeNode.create(code);
    const result = formatSqlxNode(tree, "", config);
    return postProcess(result);
}
let placeholderCounter = 0;
function formatSqlxNode(node, indent, config) {
    const { sqlxStatements, javascriptBlocks, innerSqlBlocks } = separateSqlxIntoParts(node.children());
    const formattedJsBlocks = javascriptBlocks.map((block) => {
        const raw = block.concatenate();
        if (isConfigBlock(raw)) {
            return formatConfigBlock(raw, config);
        }
        return formatJavaScript(raw, config);
    });
    const formattedSqlStatements = sqlxStatements.map((statement) => {
        const placeholders = {};
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
        const innerNode = block.children().length === 1
            ? new lexer_1.SyntaxTreeNode(lexer_1.SyntaxTreeNodeType.SQL, [
                firstPart.slice(firstPart.indexOf("{") + 1, firstPart.lastIndexOf("}")),
            ])
            : new lexer_1.SyntaxTreeNode(lexer_1.SyntaxTreeNodeType.SQL, [
                firstPart.slice(firstPart.indexOf("{") + 1),
                ...block.children().slice(1, -1),
                lastPart.slice(0, lastPart.lastIndexOf("}")),
            ]);
        return `${upToFirstBrace}\n${formatSqlxNode(innerNode, "  ", config)}\n${lastBraceOnwards}`;
    });
    const parts = [];
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
function separateSqlxIntoParts(nodeContents) {
    const sqlxStatements = [[]];
    const javascriptBlocks = [];
    const innerSqlBlocks = [];
    nodeContents.forEach((child) => {
        if (typeof child !== "string") {
            switch (child.type) {
                case lexer_1.SyntaxTreeNodeType.JAVASCRIPT:
                    javascriptBlocks.push(child);
                    return;
                case lexer_1.SyntaxTreeNodeType.SQL:
                    innerSqlBlocks.push(child);
                    return;
                case lexer_1.SyntaxTreeNodeType.SQL_STATEMENT_SEPARATOR:
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
function isConfigBlock(text) {
    return text.trimStart().startsWith("config {");
}
function formatConfigBlock(raw, config) {
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
    const sorted = config.configKeyOrder === false ? innerLines : sortConfigKeys(innerLines, config.configKeyOrder, indentSize);
    const result = [lines.slice(0, openIdx + 1).join("\n"), sorted.join("\n"), lines.slice(closeIdx).join("\n")].join("\n");
    return result;
}
function findClosingBraceLineIndex(lines, openIdx) {
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
                    if (line[j] === "\\")
                        j++;
                    j++;
                }
                continue;
            }
            if (ch === "{") {
                depth++;
                foundOpen = true;
            }
            if (ch === "}")
                depth--;
            if (foundOpen && depth === 0)
                return i;
        }
    }
    return -1;
}
function sortConfigKeys(innerLines, keyOrder, indentSize) {
    const indent = " ".repeat(indentSize);
    const keyPattern = new RegExp(`^${indent}(\\w+)\\s*:`);
    const segments = [];
    let current = null;
    for (const line of innerLines) {
        const match = line.match(keyPattern);
        if (match) {
            current = { key: match[1], lines: [line] };
            segments.push(current);
        }
        else if (current) {
            current.lines.push(line);
        }
        else {
            // Keep leading blank lines and comments as-is
            segments.push({ key: "", lines: [line] });
        }
    }
    // Handle trailing commas: strip trailing commas from each segment, then re-add after sorting
    for (const seg of segments) {
        if (seg.key === "")
            continue;
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
    const result = [];
    for (const seg of nonKeySegments) {
        result.push(...seg.lines);
    }
    for (const seg of keySegments) {
        result.push(...seg.lines);
    }
    return result;
}
function formatJavaScript(text, config) {
    return jsBeautify.js(text, {
        indent_size: config.configIndentWidth,
        preserve_newlines: true,
        max_preserve_newlines: 2,
    });
}
function formatSql(sql, config) {
    const { language, tabWidth, keywordCase, ...rest } = config.sqlFormatter;
    try {
        return (0, sql_formatter_1.format)(sql, {
            language: (language || "bigquery"),
            tabWidth: tabWidth || 2,
            keywordCase: keywordCase || "upper",
            ...rest,
        });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const firstLine = message.split("\n")[0];
        throw new Error(`SQL parse error: ${firstLine}`);
    }
}
function stripUnformattableText(parts, placeholders) {
    return parts.map((part) => {
        if (typeof part === "string") {
            return part;
        }
        const placeholderId = generatePlaceholderId();
        switch (part.type) {
            case lexer_1.SyntaxTreeNodeType.SQL_LITERAL_STRING:
            case lexer_1.SyntaxTreeNodeType.SQL_LITERAL_MULTILINE_STRING:
            case lexer_1.SyntaxTreeNodeType.JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER: {
                placeholders[placeholderId] = part;
                return placeholderId;
            }
            case lexer_1.SyntaxTreeNodeType.SQL_COMMENT: {
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
function generatePlaceholderId() {
    placeholderCounter++;
    const random = Math.random().toString(36).substring(2, 10);
    return `_ph${placeholderCounter}_${random}`;
}
function replacePlaceholders(formattedSql, placeholders, config) {
    return Object.keys(placeholders).reduce((sql, placeholderId) => {
        const value = placeholders[placeholderId];
        if (typeof value === "string") {
            return sql.replace(placeholderId, () => value);
        }
        return formatPlaceholderInSql(placeholderId, value, sql, config);
    }, formattedSql);
}
function formatPlaceholderInSql(placeholderId, node, sql, config) {
    const wholeLine = sql.split("\n").find((line) => line.includes(placeholderId));
    if (!wholeLine) {
        return sql;
    }
    const indent = " ".repeat(wholeLine.length - wholeLine.trimStart().length);
    const formatted = formatSqlQueryPlaceholder(node, indent, config);
    if (node.type !== lexer_1.SyntaxTreeNodeType.SQL_COMMENT && !formatted.includes("\n")) {
        return sql.replace(placeholderId, () => formatted.trim());
    }
    if (node.type === lexer_1.SyntaxTreeNodeType.SQL_LITERAL_MULTILINE_STRING) {
        return sql.replace(placeholderId, () => formatted.trim());
    }
    const [before, after] = wholeLine.split(placeholderId);
    const newLines = [];
    if (before.trim().length > 0) {
        newLines.push(`${indent}${before.trim()}`);
    }
    newLines.push(formatted);
    if (after.trim().length > 0) {
        newLines.push(`${indent}${after.trim()}`);
    }
    return sql.replace(wholeLine, newLines.join("\n"));
}
function formatSqlQueryPlaceholder(node, indent, config) {
    switch (node.type) {
        case lexer_1.SyntaxTreeNodeType.JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER:
            return formatJavaScriptPlaceholder(node, indent, config);
        case lexer_1.SyntaxTreeNodeType.SQL_LITERAL_STRING:
        case lexer_1.SyntaxTreeNodeType.SQL_COMMENT:
            return formatEveryLine(node.concatenate(), (line) => `${indent}${line.trimStart()}`);
        case lexer_1.SyntaxTreeNodeType.SQL_LITERAL_MULTILINE_STRING:
            return `${indent}${node.concatenate().trimStart()}`;
        default:
            return node.concatenate();
    }
}
function formatJavaScriptPlaceholder(node, indent, config) {
    const formatted = formatJavaScript(node.concatenate(), config);
    const insideBraces = formatted.slice(formatted.indexOf("{") + 1, formatted.lastIndexOf("}"));
    const finalJs = insideBraces.trim().includes("\n") ? `\${${insideBraces}}` : `\${${insideBraces.trim()}}`;
    return formatEveryLine(finalJs, (line) => `${indent}${line}`);
}
function formatEveryLine(text, mapFn) {
    return text.split("\n").map(mapFn).join("\n");
}
function postProcess(text) {
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
//# sourceMappingURL=formatter.js.map