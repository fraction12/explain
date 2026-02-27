import fs from "node:fs";
import path from "node:path";
import { ChangelogData, Entity, GraphData, RouteInfo } from "../types";
import { escapeHtml, sha256, slugify } from "../utils";

interface HtmlInput {
  outDir: string;
  entities: Entity[];
  files: Array<{ path: string; imports: string[]; exports: string[]; sourceUrl: string }>;
  routes: RouteInfo[];
  changelog: ChangelogData;
  graph: GraphData;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function pageTitle(title: string): string {
  return `${title} | Explain`;
}

function baseHead(title: string, assetPrefix: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle(title))}</title>
  <link rel="stylesheet" href="${assetPrefix}styles.css" />
</head>
<body>
<header class="topbar">
  <a href="${assetPrefix}index.html" class="brand">Explain</a>
</header>
<main class="container">`;
}

function baseFoot(): string {
  return `</main>
</body>
</html>`;
}

function filePageName(filePath: string): string {
  const slug = slugify(filePath);
  const suffix = sha256(filePath).slice(0, 8);
  return `${slug || "file"}-${suffix}.html`;
}

function entityPageName(entity: Entity): string {
  const slug = slugify(`${entity.filePath}-${entity.name}-${entity.kind}`);
  return `${slug || "entity"}-${entity.id.slice(0, 8)}.html`;
}

function toMermaid(graph: GraphData): string {
  const rows = graph.edges.map((edge) => `  \"${edge.from}\" --> \"${edge.to}\"`);
  if (rows.length === 0) {
    return "graph TD\n  A[No dependencies detected]";
  }
  return `graph TD\n${rows.join("\n")}`;
}

function buildStyles(): string {
  return `:root {
  --bg: #0f172a;
  --panel: #111827;
  --panel-2: #1f2937;
  --text: #e5e7eb;
  --muted: #9ca3af;
  --link: #7dd3fc;
  --accent: #34d399;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, -apple-system, Segoe UI, sans-serif; background: radial-gradient(circle at top, #1e293b 0%, var(--bg) 55%); color: var(--text); }
.topbar { padding: 12px 20px; border-bottom: 1px solid #243244; background: rgba(17, 24, 39, 0.9); position: sticky; top: 0; }
.brand { color: var(--text); text-decoration: none; font-weight: 700; letter-spacing: 0.02em; }
.container { max-width: 1100px; margin: 0 auto; padding: 20px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.card { background: rgba(17, 24, 39, 0.85); border: 1px solid #243244; border-radius: 10px; padding: 14px; }
a { color: var(--link); }
small, .muted { color: var(--muted); }
pre { white-space: pre-wrap; background: #0b1220; border-radius: 8px; padding: 12px; border: 1px solid #23314a; }
.table { width: 100%; border-collapse: collapse; }
.table td, .table th { border-bottom: 1px solid #243244; padding: 8px; vertical-align: top; }
.badge { font-size: 12px; border: 1px solid #355070; border-radius: 999px; padding: 2px 8px; color: #dbeafe; }
.status-failed { color: #fca5a5; }
.status-ok, .status-cached { color: var(--accent); }
`;
}

function buildScript(): string {
  return `function filterRows() {
  const input = document.getElementById('search');
  if (!input) return;
  const q = input.value.toLowerCase();
  document.querySelectorAll('[data-search]').forEach((row) => {
    const hay = row.getAttribute('data-search').toLowerCase();
    row.style.display = hay.includes(q) ? '' : 'none';
  });
}
document.getElementById('search')?.addEventListener('input', filterRows);
`;
}

export function writeHtmlReport(input: HtmlInput): void {
  const filesDir = path.join(input.outDir, "files");
  const entitiesDir = path.join(input.outDir, "entities");
  ensureDir(input.outDir);
  ensureDir(filesDir);
  ensureDir(entitiesDir);

  fs.writeFileSync(path.join(input.outDir, "styles.css"), buildStyles(), "utf8");
  fs.writeFileSync(path.join(input.outDir, "app.js"), buildScript(), "utf8");

  const filePageMap = new Map<string, string>();
  for (const file of input.files) {
    filePageMap.set(file.path, filePageName(file.path));
  }

  const entityPageMap = new Map<string, string>();
  for (const entity of input.entities) {
    entityPageMap.set(entity.id, entityPageName(entity));
  }

  for (const file of input.files) {
    const fileEntities = input.entities.filter((entity) => entity.filePath === file.path);

    const rows = fileEntities
      .map((entity) => {
        const href = `../entities/${entityPageMap.get(entity.id)}`;
        return `<tr data-search="${escapeHtml(`${entity.name} ${entity.kind}`)}"><td><a href="${href}">${escapeHtml(entity.name)}</a></td><td>${escapeHtml(entity.kind)}</td><td>${entity.exported ? "yes" : "no"}</td></tr>`;
      })
      .join("\n");

    const html = `${baseHead(`File: ${file.path}`, "../")}
<section class="card">
  <h1>${escapeHtml(file.path)}</h1>
  <p><a href="${escapeHtml(file.sourceUrl)}" target="_blank" rel="noreferrer">View source</a></p>
  <table class="table">
    <thead><tr><th>Name</th><th>Kind</th><th>Exported</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>
${baseFoot()}`;

    fs.writeFileSync(path.join(filesDir, filePageMap.get(file.path) ?? "unknown.html"), html, "utf8");
  }

  for (const entity of input.entities) {
    const fileHref = `../files/${filePageMap.get(entity.filePath)}`;
    const html = `${baseHead(`Entity: ${entity.name}`, "../")}
<section class="card">
  <h1>${escapeHtml(entity.name)} <span class="badge">${escapeHtml(entity.kind)}</span></h1>
  <p class="muted">${escapeHtml(entity.filePath)}:${entity.loc.startLine}-${entity.loc.endLine}</p>
  <p><a href="${fileHref}">Open file page</a> • <a href="${escapeHtml(entity.sourceUrl)}" target="_blank" rel="noreferrer">Source</a></p>
  ${entity.signature ? `<pre>${escapeHtml(entity.signature)}</pre>` : ""}
  <h2>Explanation</h2>
  <p class="status-${entity.explanation.status}">${escapeHtml(entity.explanation.status)}</p>
  <pre>${escapeHtml(entity.explanation.text)}</pre>
  ${entity.explanation.errorMessage ? `<p class="status-failed">${escapeHtml(entity.explanation.errorMessage)}</p>` : ""}
</section>
${baseFoot()}`;

    fs.writeFileSync(path.join(entitiesDir, entityPageMap.get(entity.id) ?? "unknown.html"), html, "utf8");
  }

  const fileCards = input.files
    .map((file) => {
      const href = `files/${filePageMap.get(file.path)}`;
      return `<div class="card" data-search="${escapeHtml(file.path)}"><h3><a href="${href}">${escapeHtml(file.path)}</a></h3><p class="muted">imports: ${file.imports.length}, exports: ${file.exports.length}</p></div>`;
    })
    .join("\n");

  const entityRows = input.entities
    .map((entity) => {
      const href = `entities/${entityPageMap.get(entity.id)}`;
      return `<tr data-search="${escapeHtml(`${entity.filePath} ${entity.name} ${entity.kind}`)}"><td><a href="${href}">${escapeHtml(entity.name)}</a></td><td>${escapeHtml(entity.kind)}</td><td>${escapeHtml(entity.filePath)}</td><td class="status-${entity.explanation.status}">${escapeHtml(entity.explanation.status)}</td></tr>`;
    })
    .join("\n");

  const routeRows = input.routes
    .map(
      (route) =>
        `<tr><td>${escapeHtml(route.method ?? "-")}</td><td>${escapeHtml(route.path ?? "-")}</td><td>${escapeHtml(route.frameworkHint)}</td><td>${escapeHtml(route.filePath)}</td></tr>`,
    )
    .join("\n");

  const changelogList = [
    ...input.changelog.addedEntities.map((id) => `<li>Added: ${escapeHtml(id)}</li>`),
    ...input.changelog.removedEntities.map((id) => `<li>Removed: ${escapeHtml(id)}</li>`),
    ...input.changelog.changedEntities.map((id) => `<li>Changed: ${escapeHtml(id)}</li>`),
  ].join("\n");

  const graphNotice = input.graph.truncated
    ? `<p class="muted">Graph truncated: omitted ${input.graph.omittedNodeCount} nodes.</p>`
    : "";

  const html = `${baseHead("Overview", "")}
<section class="card">
  <h1>Architecture Overview</h1>
  <p class="muted">Files: ${input.files.length}, Entities: ${input.entities.length}, Routes: ${input.routes.length}</p>
  <input id="search" type="search" placeholder="Search files/entities" style="width:100%;padding:10px;border-radius:8px;border:1px solid #243244;background:#0b1220;color:#e5e7eb" />
</section>

<section class="grid">
  ${fileCards}
</section>

<section class="card">
  <h2>Entities</h2>
  <table class="table">
    <thead><tr><th>Name</th><th>Kind</th><th>File</th><th>LLM</th></tr></thead>
    <tbody>${entityRows}</tbody>
  </table>
</section>

<section class="card">
  <h2>Routes</h2>
  <table class="table">
    <thead><tr><th>Method</th><th>Path</th><th>Hint</th><th>File</th></tr></thead>
    <tbody>${routeRows || "<tr><td colspan=\"4\">No routes detected</td></tr>"}</tbody>
  </table>
</section>

<section class="card">
  <h2>Dependency Graph</h2>
  ${graphNotice}
  <pre class="mermaid">${escapeHtml(toMermaid(input.graph))}</pre>
</section>

<section class="card">
  <h2>Changelog</h2>
  <p>${escapeHtml(input.changelog.summaryText)}</p>
  <ul>${changelogList || "<li>No entity-level changes detected.</li>"}</ul>
</section>

<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>mermaid.initialize({ startOnLoad: true });</script>
<script src="./app.js"></script>
${baseFoot()}`;

  fs.writeFileSync(path.join(input.outDir, "index.html"), html, "utf8");
}
