export declare enum SyntaxTreeNodeType {
    JAVASCRIPT = "JAVASCRIPT",
    JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER = "JAVASCRIPT_TEMPLATE_STRING_PLACEHOLDER",
    SQL = "SQL",
    SQL_COMMENT = "SQL_COMMENT",
    SQL_LITERAL_STRING = "SQL_LITERAL_STRING",
    SQL_LITERAL_MULTILINE_STRING = "SQL_LITERAL_MULTILINE_STRING",
    SQL_STATEMENT_SEPARATOR = "SQL_STATEMENT_SEPARATOR"
}
export declare class SyntaxTreeNode {
    static create(code: string): SyntaxTreeNode;
    readonly type: SyntaxTreeNodeType;
    private allChildren;
    constructor(type: SyntaxTreeNodeType, children?: Array<string | SyntaxTreeNode>);
    children(): Array<string | SyntaxTreeNode>;
    concatenate(): string;
    push(child: string | SyntaxTreeNode): this;
}
