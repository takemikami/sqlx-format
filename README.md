# sqlx-format

A formatter for Dataform SQLX files.

## Features

- **SQL formatting**: Formats SQL sections (BigQuery supported)
- **Config block formatting**: Sorts keys and applies consistent indentation
- **Placeholder preservation**: Preserves JS template placeholders such as `${ref("...")}`

Supported blocks: `config`, `js`, `pre_operations`, `post_operations`, `incremental_where`, `input`

## Formatting Example

### Before

```sqlx
config {
    bigquery: {
        partitionBy: "date"
    },
    tags: ["daily"],
    type: "table",
    schema: "reporting",
    description: "Weekly aggregated stats"
}

select col1, col2, col3 from ${ref("source_table")} where col1 = 'test' and col2 > 100 group by col1, col2 order by col3 desc
```

### After

```sqlx
config {
  type: "table",
  schema: "reporting",
  description: "Weekly aggregated stats",
  tags: ["daily"],
  bigquery: {
    partitionBy: "date"
  }
}

SELECT
  col1,
  col2,
  col3
FROM
  ${ref("source_table")}
WHERE
  col1 = 'test'
  AND col2 > 100
GROUP BY
  col1,
  col2
ORDER BY
  col3 DESC
```

## Installation

```bash
npm install
npm run build
```

## Usage (CLI)

```
Usage: npx sqlx-format [options] [files...]

Options:
  --stdin              Read from stdin and write to stdout
  --check              Check if files are already formatted (exits with 1 if not)
  -c, --config <path>  Path to config file (default: .sqlxformatrc)
  -V, --version        Show version
  -h, --help           Show help
```

```bash
# Format files (in-place)
npx sqlx-format definitions/**/*.sqlx

# Check formatting (for CI)
npx sqlx-format --check definitions/**/*.sqlx

# Specify config file
npx sqlx-format -c myconfig.json file.sqlx

# Read from stdin
cat file.sqlx | npx sqlx-format --stdin
```

## Usage (Library)

```typescript
import { formatSqlx, loadConfig } from "sqlx-format";

const config = loadConfig();  // Automatically searches for .sqlxformatrc
const formatted = formatSqlx(code, config);
```

## Configuration (.sqlxformatrc)

Place a `.sqlxformatrc` file (JSON format) at the project root. The config file is automatically searched from the current directory upward.

```json
{
  "sqlFormatter": {
    "language": "bigquery",
    "tabWidth": 2,
    "keywordCase": "upper"
  },
  "configKeyOrder": [
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
    "bigquery"
  ],
  "configIndentWidth": 2
}
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `sqlFormatter` | Options passed to sql-formatter | See below |
| `sqlFormatter.language` | SQL dialect | `"bigquery"` |
| `sqlFormatter.tabWidth` | SQL indent width | `2` |
| `sqlFormatter.keywordCase` | Keyword casing (`"upper"`, `"lower"`, `"preserve"`) | `"upper"` |
| `configKeyOrder` | Key order in config blocks. Keys not in the list are placed at the end in their original order. Set to `false` to disable sorting | Array shown above |
| `configIndentWidth` | Config block indent width | `2` |

Any [sql-formatter options](https://www.npmjs.com/package/sql-formatter) can be passed directly via `sqlFormatter`.

## Development

```bash
npm install          # Install dependencies
npm run build        # Build
npm test             # Run tests
npm run test:watch   # Run tests (watch mode)
npm run format       # Format code (Biome)
npm run check        # Lint check (Biome)
```

## License

MIT
