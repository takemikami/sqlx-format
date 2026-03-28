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
export declare function loadConfig(configPath?: string): SqlxFormatConfig;
