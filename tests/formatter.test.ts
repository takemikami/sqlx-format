import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import type { SqlxFormatConfig } from "../src/config";
import { formatSqlx } from "../src/formatter";

const defaultConfig: SqlxFormatConfig = {
	sqlFormatter: {
		language: "bigquery",
		tabWidth: 2,
		keywordCase: "upper",
	},
	configKeyOrder: [
		"type",
		"schema",
		"database",
		"name",
		"description",
		"tags",
		"columns",
		"disabled",
		"materialized",
		"dependencies",
		"assertions",
		"uniqueKey",
		"bigquery",
	],
	configIndentWidth: 2,
};

describe("formatSqlx", () => {
	it("should format a basic SQLX file", () => {
		const input = fs.readFileSync(path.join(__dirname, "fixtures/sample.sqlx"), "utf8");
		const result = formatSqlx(input, defaultConfig);

		// Config block should be present
		expect(result).toContain("config {");

		// SQL keywords should be uppercased
		expect(result).toContain("SELECT");
		expect(result).toContain("FROM");
		expect(result).toContain("WHERE");
		expect(result).toContain("GROUP BY");
		expect(result).toContain("ORDER BY");

		// Result should end with newline
		expect(result.endsWith("\n")).toBe(true);
	});

	it("should sort config keys according to configKeyOrder", () => {
		const input = `config {
    bigquery: { partitionBy: "date" },
    tags: ["daily"],
    type: "table",
    schema: "reporting"
}

select 1
`;
		const result = formatSqlx(input, defaultConfig);
		const typeIdx = result.indexOf("type:");
		const schemaIdx = result.indexOf("schema:");
		const tagsIdx = result.indexOf("tags:");
		const bigqueryIdx = result.indexOf("bigquery:");

		// type < schema < tags < bigquery
		expect(typeIdx).toBeLessThan(schemaIdx);
		expect(schemaIdx).toBeLessThan(tagsIdx);
		expect(tagsIdx).toBeLessThan(bigqueryIdx);
	});

	it("should preserve original key order when configKeyOrder is false", () => {
		const noSortConfig: SqlxFormatConfig = {
			...defaultConfig,
			configKeyOrder: false,
		};
		const input = `config {
    bigquery: { partitionBy: "date" },
    tags: ["daily"],
    type: "table",
    schema: "reporting"
}

select 1
`;
		const result = formatSqlx(input, noSortConfig);
		const bigqueryIdx = result.indexOf("bigquery:");
		const tagsIdx = result.indexOf("tags:");
		const typeIdx = result.indexOf("type:");
		const schemaIdx = result.indexOf("schema:");

		// Original order preserved: bigquery < tags < type < schema
		expect(bigqueryIdx).toBeLessThan(tagsIdx);
		expect(tagsIdx).toBeLessThan(typeIdx);
		expect(typeIdx).toBeLessThan(schemaIdx);
	});

	it("should handle SQL with JS placeholders", () => {
		const input = `select * from \${ref("my_table")} where id = 1`;
		const result = formatSqlx(input, defaultConfig);
		expect(result).toContain('${ref("my_table")}');
		expect(result).toContain("SELECT");
	});

	it("should handle SQL with string literals", () => {
		const input = `select * from my_table where name = 'hello world'`;
		const result = formatSqlx(input, defaultConfig);
		expect(result).toContain("'hello world'");
	});

	it("should handle pre_operations block", () => {
		const input = `config { type: "table" }

pre_operations {
  create temp table foo as select 1 as id
}

select * from foo
`;
		const result = formatSqlx(input, defaultConfig);
		expect(result).toContain("pre_operations {");
	});

	it("should format SQL-only input (no config)", () => {
		const input = `select col1, col2 from my_table where col1 > 10 order by col2`;
		const result = formatSqlx(input, defaultConfig);
		expect(result).toContain("SELECT");
		expect(result).toContain("FROM");
		expect(result).toContain("ORDER BY");
	});

	it("should throw on invalid SQL syntax", () => {
		const input = "select * from )invalid";
		expect(() => formatSqlx(input, defaultConfig)).toThrow("SQL parse error");
	});

	it("should handle empty input", () => {
		const result = formatSqlx("", defaultConfig);
		expect(result).toBe("\n");
	});

	it("should handle SQL with single-line comment", () => {
		const input = `select col1 -- this is a comment
from my_table`;
		const result = formatSqlx(input, defaultConfig);
		expect(result).toContain("-- this is a comment");
		expect(result).toContain("SELECT");
	});

	it("should handle SQL with multi-line comment", () => {
		const input = `select col1 /* block comment */ from my_table`;
		const result = formatSqlx(input, defaultConfig);
		expect(result).toContain("/* block comment */");
	});

	it("should handle SQL with multiline string literal", () => {
		const input = `select * from my_table where name = '''
hello
world
'''`;
		const result = formatSqlx(input, defaultConfig);
		expect(result).toContain("'''");
		expect(result).toContain("hello");
	});

	it("should handle statement separator (---)", () => {
		const input = `select 1 as a
---
select 2 as b`;
		const result = formatSqlx(input, defaultConfig);
		expect(result).toContain("---");
		expect(result).toContain("SELECT\n  1 AS a");
		expect(result).toContain("SELECT\n  2 AS b");
	});

	it("should handle config with braces in string values", () => {
		const input = `config {
  type: "table",
  description: "value with {braces}"
}

select 1`;
		const result = formatSqlx(input, defaultConfig);
		expect(result).toContain('description: "value with {braces}"');
	});

	it("should handle consecutive blank lines in SQL", () => {
		const input = `select col1 from my_table


where col1 > 10`;
		const result = formatSqlx(input, defaultConfig);
		// postProcess should collapse consecutive blank lines
		expect(result).not.toContain("\n\n\n");
	});

	it("should be idempotent", () => {
		const input = `config {
  type: "table",
  schema: "reporting"
}

select col1, col2 from my_table where col1 > 10
`;
		const first = formatSqlx(input, defaultConfig);
		const second = formatSqlx(first, defaultConfig);
		expect(first).toBe(second);
	});
});
