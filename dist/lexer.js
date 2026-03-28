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
exports.SyntaxTreeNode = exports.SyntaxTreeNodeType = void 0;
const moo = __importStar(require("moo"));
var SyntaxTreeNodeType;
(function (SyntaxTreeNodeType) {
    SyntaxTreeNodeType["JAVASCRIPT"] = "JAVASCRIPT";
    SyntaxTreeNodeType["JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER"] = "JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER";
    SyntaxTreeNodeType["SQL"] = "SQL";
    SyntaxTreeNodeType["SQL_COMMENT"] = "SQL_COMMENT";
    SyntaxTreeNodeType["SQL_LITERAL_STRING"] = "SQL_LITERAL_STRING";
    SyntaxTreeNodeType["SQL_LITERAL_MULTILINE_STRING"] = "SQL_LITERAL_MULTILINE_STRING";
    SyntaxTreeNodeType["SQL_STATEMENT_SEPARATOR"] = "SQL_STATEMENT_SEPARATOR";
})(SyntaxTreeNodeType || (exports.SyntaxTreeNodeType = SyntaxTreeNodeType = {}));
const START_TOKEN_NODE_MAPPINGS = new Map([
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
const CLOSE_TOKEN_TYPES = new Set([
    "jsBlock_closeBlock",
    "innerSqlBlock_closeBlock",
    "innerSingleQuote_close",
    "innerDoubleQuote_close",
    "innerTripleSingleQuote_close",
    "innerTripleDoubleQuote_close",
]);
const WHOLE_TOKEN_NODE_MAPPINGS = new Map([
    ["sql_singleLineComment", SyntaxTreeNodeType.SQL_COMMENT],
    ["sql_multiLineComment", SyntaxTreeNodeType.SQL_COMMENT],
    ["sql_statementSeparator", SyntaxTreeNodeType.SQL_STATEMENT_SEPARATOR],
    ["innerSqlBlock_singleLineComment", SyntaxTreeNodeType.SQL_COMMENT],
    ["innerSqlBlock_multiLineComment", SyntaxTreeNodeType.SQL_COMMENT],
    ["innerSqlBlock_statementSeparator", SyntaxTreeNodeType.SQL_STATEMENT_SEPARATOR],
]);
class SyntaxTreeNode {
    static create(code) {
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
                const childType = START_TOKEN_NODE_MAPPINGS.get(token.type);
                if (childType === SyntaxTreeNodeType.SQL && currentNode.type !== SyntaxTreeNodeType.SQL) {
                    throw new Error("SQL syntax tree nodes may only be children of other SQL nodes.");
                }
                const newCurrentNode = new SyntaxTreeNode(childType, [token.value]);
                nodeStack.push(newCurrentNode);
                currentNode.push(newCurrentNode);
                currentNode = newCurrentNode;
            }
            else if (CLOSE_TOKEN_TYPES.has(token.type)) {
                currentNode.push(token.value);
                nodeStack.pop();
                currentNode = nodeStack[nodeStack.length - 1];
            }
            else if (WHOLE_TOKEN_NODE_MAPPINGS.has(token.type)) {
                currentNode.push(new SyntaxTreeNode(WHOLE_TOKEN_NODE_MAPPINGS.get(token.type)).push(token.value));
            }
            else {
                currentNode.push(token.value);
            }
        }
        return parentNode;
    }
    constructor(type, children = []) {
        this.type = type;
        this.allChildren = children;
    }
    children() {
        return this.allChildren.slice();
    }
    concatenate() {
        return this.allChildren
            .map((child) => {
            if (typeof child === "string") {
                return child;
            }
            return child.concatenate();
        })
            .join("");
    }
    push(child) {
        if (this.allChildren.length > 0 &&
            typeof child === "string" &&
            typeof this.allChildren[this.allChildren.length - 1] === "string") {
            this.allChildren[this.allChildren.length - 1] = this.allChildren[this.allChildren.length - 1] + child;
            return this;
        }
        this.allChildren.push(child);
        return this;
    }
}
exports.SyntaxTreeNode = SyntaxTreeNode;
function createQuoteLexer(stateName, closeMatch, escapedQuote) {
    const rules = {};
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
function addSqlQuoteRules(rules, prefix) {
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
function buildSqlxLexer() {
    const sqlLexer = {};
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
    const jsBlockLexer = {};
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
    const jsTemplateStringLexer = {};
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
    const innerSqlBlockLexer = {};
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
//# sourceMappingURL=lexer.js.map