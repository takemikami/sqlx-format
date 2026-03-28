#!/usr/bin/env node
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
const fs = __importStar(require("node:fs"));
const commander_1 = require("commander");
const config_1 = require("./config");
const formatter_1 = require("./formatter");
const program = new commander_1.Command();
program
    .name("sqlx-format")
    .description("Formatter for Dataform SQLX files")
    .version("0.1.0")
    .argument("[files...]", "SQLX files to format")
    .option("--stdin", "Read from stdin and write formatted output to stdout")
    .option("--check", "Check if files are formatted (exit 1 if not)")
    .option("-c, --config <path>", "Path to config file (default: .sqlxformatrc)")
    .action(async (files, options) => {
    const config = (0, config_1.loadConfig)(options.config);
    if (options.stdin) {
        const chunks = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk);
        }
        const input = Buffer.concat(chunks).toString("utf8");
        try {
            const formatted = (0, formatter_1.formatSqlx)(input, config);
            process.stdout.write(formatted);
        }
        catch (e) {
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
        let formatted;
        try {
            formatted = (0, formatter_1.formatSqlx)(content, config);
        }
        catch (e) {
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
        }
        else {
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
//# sourceMappingURL=cli.js.map