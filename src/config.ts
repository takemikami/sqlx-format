import * as fs from "node:fs";
import * as path from "node:path";

export interface SqlxFormatConfig {
	/** Options passed to sql-formatter's format() */
	sqlFormatter: {
		language?: string;
		tabWidth?: number;
		keywordCase?: "upper" | "lower" | "preserve";
		[key: string]: unknown;
	};
	/** Order of keys in config block. Keys not listed appear at the end in original order. Set to false to disable sorting. */
	configKeyOrder: string[] | false;
	/** Indent width for config block formatting (js-beautify indent_size) */
	configIndentWidth: number;
}

const DEFAULT_CONFIG: SqlxFormatConfig = {
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

export function loadConfig(configPath?: string): SqlxFormatConfig {
	const filePath = configPath || findConfigFile();
	if (!filePath) {
		return { ...DEFAULT_CONFIG };
	}

	try {
		const content = fs.readFileSync(filePath, "utf8");
		const userConfig = JSON.parse(content);
		return mergeConfig(DEFAULT_CONFIG, userConfig);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		console.error(`Warning: Failed to load config from ${filePath}: ${message}`);
		return { ...DEFAULT_CONFIG };
	}
}

function findConfigFile(): string | null {
	let dir = process.cwd();
	while (true) {
		const candidate = path.join(dir, ".sqlxformatrc");
		if (fs.existsSync(candidate)) {
			return candidate;
		}
		const parent = path.dirname(dir);
		if (parent === dir) {
			return null;
		}
		dir = parent;
	}
}

function mergeConfig(defaults: SqlxFormatConfig, user: Partial<SqlxFormatConfig>): SqlxFormatConfig {
	return {
		sqlFormatter: { ...defaults.sqlFormatter, ...user.sqlFormatter },
		configKeyOrder: user.configKeyOrder !== undefined ? user.configKeyOrder : defaults.configKeyOrder,
		configIndentWidth: user.configIndentWidth ?? defaults.configIndentWidth,
	};
}
