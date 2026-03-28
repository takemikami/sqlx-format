#!/usr/bin/env node

import * as fs from "node:fs";
import { Command } from "commander";
import { loadConfig } from "./config";
import { formatSqlx } from "./formatter";

const program = new Command();

program
	.name("sqlx-format")
	.description("Formatter for Dataform SQLX files")
	.version("0.1.0")
	.argument("[files...]", "SQLX files to format")
	.option("--stdin", "Read from stdin and write formatted output to stdout")
	.option("--check", "Check if files are formatted (exit 1 if not)")
	.option("-c, --config <path>", "Path to config file (default: .sqlxformatrc)")
	.action(async (files: string[], options) => {
		const config = loadConfig(options.config);

		if (options.stdin) {
			const chunks: Buffer[] = [];
			for await (const chunk of process.stdin) {
				chunks.push(chunk);
			}
			const input = Buffer.concat(chunks).toString("utf8");
			try {
				const formatted = formatSqlx(input, config);
				process.stdout.write(formatted);
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				console.error(`stdin: ${message}`);
				process.exit(1);
			}
			return;
		}

		if (files.length === 0) {
			program.help();
		}

		let hasUnformatted = false;

		for (const file of files) {
			const content = fs.readFileSync(file, "utf8");
			let formatted: string;
			try {
				formatted = formatSqlx(content, config);
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				console.error(`${file}: ${message}`);
				hasUnformatted = true;
				continue;
			}

			if (options.check) {
				if (content !== formatted) {
					console.error(`${file}: not formatted`);
					hasUnformatted = true;
				}
			} else {
				if (content !== formatted) {
					fs.writeFileSync(file, formatted);
					console.error(`${file}: formatted`);
				}
			}
		}

		if (options.check && hasUnformatted) {
			process.exit(1);
		}
	});

program.parse();
