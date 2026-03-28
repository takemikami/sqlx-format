import * as moo from "moo";

export enum SyntaxTreeNodeType {
	JAVASCRIPT = "JAVASCRIPT",
	JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER = "JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER",
	SQL = "SQL",
	SQL_COMMENT = "SQL_COMMENT",
	SQL_LITERAL_STRING = "SQL_LITERAL_STRING",
	SQL_LITERAL_MULTILINE_STRING = "SQL_LITERAL_MULTILINE_STRING",
	SQL_STATEMENT_SEPARATOR = "SQL_STATEMENT_SEPARATOR",
}

const START_TOKEN_NODE_MAPPINGS = new Map<string, SyntaxTreeNodeType>([
	["sql_startConfig", SyntaxTreeNodeType.JAVASCRIPT],
	["sql_startJs", SyntaxTreeNodeType.JAVASCRIPT],
	["sql_startIncremental", SyntaxTreeNodeType.SQL],
	["sql_startPreOperations", SyntaxTreeNodeType.SQL],
	["sql_startPostOperations", SyntaxTreeNodeType.SQL],
	["sql_startInput", SyntaxTreeNodeType.SQL],
	["sql_startJsPlaceholder", SyntaxTreeNodeType.JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER],
	["sql_startQuoteSingle", SyntaxTreeNodeType.SQL_LITERAL_STRING],
	["sql_startQuoteDouble", SyntaxTreeNodeType.SQL_LITERAL_STRING],
	["sql_startTripleQuoteSingle", SyntaxTreeNodeType.SQL_LITERAL_MULTILINE_STRING],
	["sql_startTripleQuoteDouble", SyntaxTreeNodeType.SQL_LITERAL_MULTILINE_STRING],
	["jsBlock_startJsBlock", SyntaxTreeNodeType.JAVASCRIPT],
	["jsTemplateString_startJsBlock", SyntaxTreeNodeType.JAVASCRIPT],
	["innerSqlBlock_startJsPlaceholder", SyntaxTreeNodeType.JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER],
	["innerSqlBlock_startQuoteSingle", SyntaxTreeNodeType.SQL_LITERAL_STRING],
	["innerSqlBlock_startQuoteDouble", SyntaxTreeNodeType.SQL_LITERAL_STRING],
	["innerSqlBlock_startTripleQuoteSingle", SyntaxTreeNodeType.SQL_LITERAL_MULTILINE_STRING],
	["innerSqlBlock_startTripleQuoteDouble", SyntaxTreeNodeType.SQL_LITERAL_MULTILINE_STRING],
	["innerSingleQuote_startJsPlaceholder", SyntaxTreeNodeType.JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER],
	["innerDoubleQuote_startJsPlaceholder", SyntaxTreeNodeType.JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER],
	["innerTripleSingleQuote_startJsPlaceholder", SyntaxTreeNodeType.JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER],
	["innerTripleDoubleQuote_startJsPlaceholder", SyntaxTreeNodeType.JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER],
]);

const CLOSE_TOKEN_TYPES = new Set<string>([
	"jsBlock_closeBlock",
	"innerSqlBlock_closeBlock",
	"innerSingleQuote_close",
	"innerDoubleQuote_close",
	"innerTripleSingleQuote_close",
	"innerTripleDoubleQuote_close",
]);

const WHOLE_TOKEN_NODE_MAPPINGS = new Map<string, SyntaxTreeNodeType>([
	["sql_singleLineComment", SyntaxTreeNodeType.SQL_COMMENT],
	["sql_multiLineComment", SyntaxTreeNodeType.SQL_COMMENT],
	["sql_statementSeparator", SyntaxTreeNodeType.SQL_STATEMENT_SEPARATOR],
	["innerSqlBlock_singleLineComment", SyntaxTreeNodeType.SQL_COMMENT],
	["innerSqlBlock_multiLineComment", SyntaxTreeNodeType.SQL_COMMENT],
	["innerSqlBlock_statementSeparator", SyntaxTreeNodeType.SQL_STATEMENT_SEPARATOR],
]);

export class SyntaxTreeNode {
	public static create(code: string): SyntaxTreeNode {
		const parentNode = new SyntaxTreeNode(SyntaxTreeNodeType.SQL);
		let currentNode = parentNode;
		const nodeStack = [currentNode];
		const lexer = moo.states(buildSqlxLexer());
		lexer.reset(code);
		for (const token of lexer) {
			if (!token.type) {
				throw new Error("Undefined token type encountered.");
			}
			if (START_TOKEN_NODE_MAPPINGS.has(token.type)) {
				const childType = START_TOKEN_NODE_MAPPINGS.get(token.type)!;
				if (childType === SyntaxTreeNodeType.SQL && currentNode.type !== SyntaxTreeNodeType.SQL) {
					throw new Error("SQL syntax tree nodes may only be children of other SQL nodes.");
				}
				const newCurrentNode = new SyntaxTreeNode(childType, [token.value]);
				nodeStack.push(newCurrentNode);
				currentNode.push(newCurrentNode);
				currentNode = newCurrentNode;
			} else if (CLOSE_TOKEN_TYPES.has(token.type)) {
				currentNode.push(token.value);
				nodeStack.pop();
				currentNode = nodeStack[nodeStack.length - 1];
			} else if (WHOLE_TOKEN_NODE_MAPPINGS.has(token.type)) {
				currentNode.push(new SyntaxTreeNode(WHOLE_TOKEN_NODE_MAPPINGS.get(token.type)!).push(token.value));
			} else {
				currentNode.push(token.value);
			}
		}
		return parentNode;
	}

	public readonly type: SyntaxTreeNodeType;
	private allChildren: Array<string | SyntaxTreeNode>;

	public constructor(type: SyntaxTreeNodeType, children: Array<string | SyntaxTreeNode> = []) {
		this.type = type;
		this.allChildren = children;
	}

	public children(): Array<string | SyntaxTreeNode> {
		return this.allChildren.slice();
	}

	public concatenate(): string {
		return this.allChildren
			.map((child) => {
				if (typeof child === "string") {
					return child;
				}
				return child.concatenate();
			})
			.join("");
	}

	public push(child: string | SyntaxTreeNode): this {
		if (
			this.allChildren.length > 0 &&
			typeof child === "string" &&
			typeof this.allChildren[this.allChildren.length - 1] === "string"
		) {
			this.allChildren[this.allChildren.length - 1] = (this.allChildren[this.allChildren.length - 1] as string) + child;
			return this;
		}
		this.allChildren.push(child);
		return this;
	}
}

function createQuoteLexer(stateName: string, closeMatch: string, escapedQuote?: string): moo.Rules {
	const rules: moo.Rules = {};
	rules[`${stateName}_escapedBackslash`] = "\\\\";
	if (escapedQuote) {
		rules[`${stateName}_escapedQuote`] = escapedQuote;
	}
	rules[`${stateName}_startJsPlaceholder`] = {
		match: "${",
		push: "jsBlock",
	};
	rules[`${stateName}_close`] = { match: closeMatch, pop: 1 };
	rules[`${stateName}_captureEverythingElse`] = {
		match: /[\s\S]+?/,
		lineBreaks: true,
	};
	return rules;
}

function addSqlQuoteRules(rules: moo.Rules, prefix: string): void {
	rules[`${prefix}_backtick`] = "`";
	rules[`${prefix}_startTripleQuoteSingle`] = {
		match: "'''",
		push: "innerTripleSingleQuote",
	};
	rules[`${prefix}_startTripleQuoteDouble`] = {
		match: '"""',
		push: "innerTripleDoubleQuote",
	};
	rules[`${prefix}_startQuoteSingle`] = {
		match: "'",
		push: "innerSingleQuote",
	};
	rules[`${prefix}_startQuoteDouble`] = {
		match: '"',
		push: "innerDoubleQuote",
	};
	rules[`${prefix}_captureEverythingElse`] = {
		match: /[\s\S]+?/,
		lineBreaks: true,
	};
}

function buildSqlxLexer(): { [x: string]: moo.Rules } {
	const sqlLexer: moo.Rules = {};
	sqlLexer.sql_startConfig = { match: "config {", push: "jsBlock" };
	sqlLexer.sql_startJs = { match: "js {", push: "jsBlock" };
	sqlLexer.sql_startIncremental = {
		match: "incremental_where {",
		push: "innerSqlBlock",
	};
	sqlLexer.sql_startPreOperations = {
		match: "pre_operations {",
		push: "innerSqlBlock",
	};
	sqlLexer.sql_startPostOperations = {
		match: "post_operations {",
		push: "innerSqlBlock",
	};
	sqlLexer.sql_startInput = {
		match: /input "[a-zA-Z0-9_-]+"(?:,\s*"[a-zA-Z0-9_-]+")* {/,
		push: "innerSqlBlock",
	};
	sqlLexer.sql_statementSeparator = /[^\S\r\n]*---[^\S\r\n]*$/;
	sqlLexer.sql_singleLineComment = /--.*?$/;
	sqlLexer.sql_multiLineComment = /\/\*[\s\S]*?\*\//;
	sqlLexer.sql_startJsPlaceholder = { match: "${", push: "jsBlock" };
	addSqlQuoteRules(sqlLexer, "sql");

	const jsBlockLexer: moo.Rules = {};
	jsBlockLexer.jsBlock_singleLineComment = /\/\/.*?$/;
	jsBlockLexer.jsBlock_multiLineComment = /\/\*[\s\S]*?\*\//;
	jsBlockLexer.jsBlock_singleQuoteString = /'(?:\\['\\]|[^\n'\\])*'/;
	jsBlockLexer.jsBlock_doubleQuoteString = /"(?:\\["\\]|[^\n"\\])*"/;
	jsBlockLexer.jsBlock_startJsTemplateString = {
		match: "`",
		push: "jsTemplateString",
	};
	jsBlockLexer.jsBlock_startJsBlock = { match: "{", push: "jsBlock" };
	jsBlockLexer.jsBlock_closeBlock = { match: "}", pop: 1 };
	jsBlockLexer.jsBlock_captureEverythingElse = {
		match: /[\s\S]+?/,
		lineBreaks: true,
	};

	const jsTemplateStringLexer: moo.Rules = {};
	jsTemplateStringLexer.jsTemplateString_escapedBackslash = /\\\\/;
	jsTemplateStringLexer.jsTemplateString_escapedDollarBrace = /\\\$\{/;
	jsTemplateStringLexer.jsTemplateString_startJsBlock = {
		match: "${",
		push: "jsBlock",
	};
	jsTemplateStringLexer.jsTemplateString_closeString = {
		match: "`",
		pop: 1,
	};
	jsTemplateStringLexer.jsTemplateString_captureEverythingElse = {
		match: /[\s\S]+?/,
		lineBreaks: true,
	};

	const innerSqlBlockLexer: moo.Rules = {};
	innerSqlBlockLexer.innerSqlBlock_statementSeparator = /[^\S\r\n]*---[^\S\r\n]*$/;
	innerSqlBlockLexer.innerSqlBlock_singleLineComment = /--.*?$/;
	innerSqlBlockLexer.innerSqlBlock_multiLineComment = /\/\*[\s\S]*?\*\//;
	innerSqlBlockLexer.innerSqlBlock_startJsPlaceholder = {
		match: "${",
		push: "jsBlock",
	};
	innerSqlBlockLexer.innerSqlBlock_closeBlock = { match: "}", pop: 1 };
	addSqlQuoteRules(innerSqlBlockLexer, "innerSqlBlock");

	return {
		sql: sqlLexer,
		jsBlock: jsBlockLexer,
		jsTemplateString: jsTemplateStringLexer,
		innerSqlBlock: innerSqlBlockLexer,
		innerSingleQuote: createQuoteLexer("innerSingleQuote", "'", "\\'"),
		innerDoubleQuote: createQuoteLexer("innerDoubleQuote", '"', '\\"'),
		innerTripleSingleQuote: createQuoteLexer("innerTripleSingleQuote", "'''"),
		innerTripleDoubleQuote: createQuoteLexer("innerTripleDoubleQuote", '"""'),
	};
}
