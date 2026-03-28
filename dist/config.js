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
exports.loadConfig = loadConfig;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const DEFAULT_CONFIG = {
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
function loadConfig(configPath) {
    const filePath = configPath || findConfigFile();
    if (!filePath) {
        return { ...DEFAULT_CONFIG };
    }
    try {
        const content = fs.readFileSync(filePath, "utf8");
        const userConfig = JSON.parse(content);
        return mergeConfig(DEFAULT_CONFIG, userConfig);
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`Warning: Failed to load config from ${filePath}: ${message}`);
        return { ...DEFAULT_CONFIG };
    }
}
function findConfigFile() {
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
function mergeConfig(defaults, user) {
    return {
        sqlFormatter: { ...defaults.sqlFormatter, ...user.sqlFormatter },
        configKeyOrder: user.configKeyOrder !== undefined ? user.configKeyOrder : defaults.configKeyOrder,
        configIndentWidth: user.configIndentWidth ?? defaults.configIndentWidth,
    };
}
//# sourceMappingURL=config.js.map