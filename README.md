# Explain

Turn any TypeScript/JavaScript codebase into a living, human-readable architecture document. Automatically.

Push to `main` → GitHub Action runs → your entire codebase is explained in plain English on a static web page.

Built for PMs, founders, and anyone who builds with AI but needs to actually understand what got built.

## How It Works

1. **Push to main** — GitHub Action triggers
2. **AST parsing** — ts-morph extracts every function, component, type, constant, route, and import
3. **Diff detection** — only changed files get re-analyzed (everything else is cached)
4. **LLM explanation** — each entity gets a plain-English description via a single stateless API call
5. **Static site builds** — HTML page with file tree, entity index, dependency graph, and changelog
6. **Deployed** — GitHub Pages, always up to date

## Stack

| Layer | Tool |
|-------|------|
| Language | TypeScript / Node.js |
| AST Parser | [ts-morph](https://ts-morph.com/) |
| LLM Client | [openai](https://www.npmjs.com/package/openai) (any OpenAI-compatible API) |
| Cache | JSON file (SHA-256 keyed) |
| Dependency Graph | [Mermaid.js](https://mermaid.js.org/) |
| Git Diff | [simple-git](https://www.npmjs.com/package/simple-git) |
| Output | Static HTML |
| CI/CD | GitHub Actions |
| Hosting | GitHub Pages |

## MVP Scope (v1)

- **TypeScript / JavaScript only**
- File-level summaries
- Function-level — named functions, arrow functions, class methods, exported expressions
- Component-level — React/JSX components as first-class entities
- Type definitions — interfaces, type aliases, enums in plain English
- Constants & config — exported constants, env variable usage
- Imports/exports map
- Route definitions — API endpoint handlers
- Visual dependency graph (Mermaid, file-level, direct dependencies, capped at 50 nodes)
- Changelog — "What changed in the last commit" in plain English
- Source links — every entity links to the exact file + line on GitHub
- Provider-agnostic LLM — bring your own API key (OpenAI, Anthropic, Ollama, etc.)
- Mobile-responsive

## Setup

```bash
npm install
```

## Quick Start (Zero Config)

Run directly against any TypeScript/JavaScript repo:

```bash
npx explain /absolute/path/to/repo
```

If no API key is found, `explain` will prompt for one and optionally save it to `<repo>/.env`.

### Optional explicit setup (`init`)

```bash
npx explain init /absolute/path/to/repo --api-key <key>
```

This creates a minimal `.explainrc.json` and saves `EXPLAIN_API_KEY` into `<repo>/.env`.

### Optional `.explainrc.json`

`explain` works without config, but if you want to customize behavior:

```json
{
  "include": ["**/*.{ts,tsx,js,jsx}"],
  "exclude": ["**/*.test.*", "**/*.spec.*", "node_modules/**", "dist/**", "build/**"],
  "llm": {
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4o-mini",
    "apiKey": "$EXPLAIN_API_KEY"
  },
  "output": "explain-output",
  "repoUrl": "https://github.com/your-org/your-repo"
}
```

### CLI options

```bash
explain <repoPath> \
  [--config .explainrc.json] \
  [--output explain-output] \
  [--json explain-output/report.json] \
  [--html explain-output] \
  [--max-graph-nodes 50] \
  [--base-url https://api.openai.com/v1] \
  [--model gpt-4o-mini] \
  [--api-key <key>] \
  [--no-prompt] \
  [--force] \
  [--verbose]
```

### Output artifacts

- Multi-page HTML site:
  - `index.html` overview
  - `files/*.html` per-file pages
  - `entities/*.html` per-entity pages
- Versioned JSON report: `report.json` (`schemaVersion: "1.0"`)
- Incremental cache: `.explain/cache.json` in the analyzed repo

### GitHub Action

```yaml
# .github/workflows/explain.yml
name: Explain
on:
  push:
    branches: [main]

jobs:
  explain:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2  # need previous commit for diff
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx @aspect-build/explain --api-key ${{ secrets.EXPLAIN_API_KEY }}
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs
```

## What's NOT in v1

- No auth / login
- No multi-repo support
- No PR-level analysis (main branch only)
- No historical diffing
- No multi-language support (TypeScript/JavaScript only)

## v2 Roadmap

- Multi-page routing (navigable pages per directory)
- PR mode (run on PR open, post summary as comment)
- Deep dependency graph (transitive deps, call chains, request tracing)
- Multi-language (Python, Go, Rust)
- Historical view (architecture evolution over time)
- Search across all explanations
- Diff view (before/after explanations)
- Team features (annotations, comments, bookmarks)
- Hosted SaaS version
- Monorepo awareness
- Custom explanation prompts ("explain like I'm a PM" vs "explain like I'm a junior dev")

## License

MIT
