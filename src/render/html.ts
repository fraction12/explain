import fs from "node:fs";
import path from "node:path";
import { ChangelogData, DomainGroup, Entity, GraphData, RouteInfo } from "../types";
import { escapeHtml, sha256, slugify } from "../utils";

interface HtmlInput {
  outDir: string;
  entities: Entity[];
  files: Array<{ path: string; imports: string[]; exports: string[]; sourceUrl: string }>;
  routes: RouteInfo[];
  changelog: ChangelogData;
  graph: GraphData;
  projectSummary: string;
  domains: DomainGroup[];
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function pageTitle(title: string): string {
  return `${title} | Explain`;
}

function buildNav(assetPrefix: string): string {
  return `<nav class="navbar">
  <a href="${assetPrefix}index.html" class="brand">Explain</a>
  <div class="nav-links">
    <a href="${assetPrefix}index.html">Overview</a>
    <a href="${assetPrefix}api.html">API Reference</a>
    <a href="${assetPrefix}graph.html">Graph Explorer</a>
    <a href="${assetPrefix}reference.html">Developer Reference</a>
    <a href="${assetPrefix}changelog.html">What Changed</a>
  </div>
</nav>`;
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
${buildNav(assetPrefix)}
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
.container { max-width: 1100px; margin: 0 auto; padding: 20px; }
a { color: var(--link); }
small, .muted { color: var(--muted); }
pre { white-space: pre-wrap; background: #0b1220; border-radius: 8px; padding: 12px; border: 1px solid #23314a; }
.table { width: 100%; border-collapse: collapse; }
.table td, .table th { border-bottom: 1px solid #243244; padding: 8px; vertical-align: top; }
.badge { font-size: 12px; border: 1px solid #355070; border-radius: 999px; padding: 2px 8px; color: #dbeafe; }
.status-failed { color: #fca5a5; }
.status-ok, .status-cached { color: var(--accent); }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.card { background: rgba(17, 24, 39, 0.85); border: 1px solid #243244; border-radius: 10px; padding: 14px; margin-bottom: 14px; }

/* Navigation */
.navbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid #243244; background: rgba(17, 24, 39, 0.95); position: sticky; top: 0; z-index: 100; backdrop-filter: blur(8px); }
.navbar .brand { color: #e5e7eb; text-decoration: none; font-weight: 700; font-size: 1.1em; }
.nav-links { display: flex; gap: 20px; }
.nav-links a { color: #9ca3af; text-decoration: none; font-size: 0.9em; transition: color 0.2s; }
.nav-links a:hover, .nav-links a.active { color: #7dd3fc; }

/* Domain cards */
.domain-card { background: rgba(17, 24, 39, 0.85); border: 1px solid #243244; border-radius: 12px; padding: 20px; transition: border-color 0.2s; }
.domain-card:hover { border-color: #7dd3fc; }
.domain-card .emoji { font-size: 2em; margin-bottom: 8px; display: block; }
.domain-card h3 { margin: 0 0 8px 0; }
.domain-card p { margin: 0 0 12px 0; color: #9ca3af; font-size: 0.95em; }

/* Method badges */
.method-badge { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 0.8em; font-weight: 700; font-family: monospace; }
.method-get { background: rgba(52, 211, 153, 0.15); color: #34d399; }
.method-post { background: rgba(125, 211, 252, 0.15); color: #7dd3fc; }
.method-put { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.method-delete { background: rgba(248, 113, 113, 0.15); color: #f87171; }
.method-options { background: rgba(156, 163, 175, 0.15); color: #9ca3af; }

/* Kind badges */
.kind-badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 0.75em; border: 1px solid #355070; color: #dbeafe; margin-left: 8px; }

/* Inline entity on domain pages */
.entity-block { margin-bottom: 20px; padding: 16px; background: rgba(11, 18, 32, 0.6); border-radius: 8px; border-left: 3px solid #355070; }
.entity-block h3 { margin: 0 0 8px 0; font-size: 1em; }
.entity-block .explanation { color: #d1d5db; line-height: 1.6; margin: 8px 0; }
.entity-block .meta { font-size: 0.8em; color: #6b7280; }

/* Graph */
.graph-wrap { position: relative; }
.graph-container { width: 100%; height: calc(100vh - 60px); }
.graph-tooltip { position: absolute; background: rgba(17, 24, 39, 0.95); border: 1px solid #243244; border-radius: 8px; padding: 10px 14px; color: #e5e7eb; font-size: 0.85em; pointer-events: none; z-index: 200; display: none; }
.graph-legend { position: absolute; top: 80px; right: 20px; background: rgba(17, 24, 39, 0.9); border: 1px solid #243244; border-radius: 8px; padding: 12px; }
.graph-legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 0.85em; }
.graph-legend-dot { width: 12px; height: 12px; border-radius: 50%; }
`;
}

function buildScript(): string {
  return `function filterRows() {
  const input = document.getElementById('search');
  if (!input) return;
  const q = input.value.toLowerCase();
  document.querySelectorAll('[data-search]').forEach((row) => {
    const hay = (row.getAttribute('data-search') || '').toLowerCase();
    row.style.display = hay.includes(q) ? '' : 'none';
  });
}
document.getElementById('search')?.addEventListener('input', filterRows);
`;
}

function inferApiPath(filePath: string): string | null {
  if (!filePath.startsWith("src/pages/")) return null;
  let route = filePath.slice("src/pages/".length);
  route = route.replace(/\.ts$/, "");
  route = route.replace(/\[(.+?)\]/g, ":$1");
  route = route.replace(/\/index$/g, "");
  route = route.replace(/^index$/g, "");
  return `/${route}`.replace(/\/+/g, "/") || "/";
}

export function writeHtmlReport(input: HtmlInput): void {
  const filesDir = path.join(input.outDir, "files");
  const entitiesDir = path.join(input.outDir, "entities");
  const domainsDir = path.join(input.outDir, "domains");
  ensureDir(input.outDir);
  ensureDir(filesDir);
  ensureDir(entitiesDir);
  ensureDir(domainsDir);

  fs.writeFileSync(path.join(input.outDir, "styles.css"), buildStyles(), "utf8");
  fs.writeFileSync(path.join(input.outDir, "app.js"), buildScript(), "utf8");

  const filePageMap = new Map<string, string>();
  for (const file of input.files) filePageMap.set(file.path, filePageName(file.path));

  const entityPageMap = new Map<string, string>();
  for (const entity of input.entities) entityPageMap.set(entity.id, entityPageName(entity));

  const palette = ["#34d399", "#7dd3fc", "#fbbf24", "#f87171", "#a78bfa", "#fb923c", "#f472b6", "#2dd4bf"];
  const domainColorMap = new Map<string, string>();
  input.domains.forEach((d, i) => domainColorMap.set(d.name, palette[i % palette.length]));
  const fileToDomain = new Map<string, DomainGroup>();
  for (const domain of input.domains) {
    for (const file of domain.files) fileToDomain.set(file, domain);
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
  ${entity.explanation.status !== "ok" && entity.explanation.status !== "cached" ? `<p class="status-${entity.explanation.status}">${escapeHtml(entity.explanation.status)}</p>` : ""}
  <pre>${escapeHtml(entity.explanation.text)}</pre>
  ${entity.explanation.errorMessage ? `<p class="status-failed">${escapeHtml(entity.explanation.errorMessage)}</p>` : ""}
</section>
${baseFoot()}`;

    fs.writeFileSync(path.join(entitiesDir, entityPageMap.get(entity.id) ?? "unknown.html"), html, "utf8");
  }

  for (const domain of input.domains) {
    const fileBlocks = domain.files
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .map((filePath) => {
        const file = input.files.find((f) => f.path === filePath);
        const fileHref = `../files/${filePageMap.get(filePath)}`;
        const entities = input.entities.filter((e) => e.filePath === filePath);
        if (entities.length === 0) {
          return `<section class="card"><h2><a href="${fileHref}">${escapeHtml(filePath)}</a></h2><p class="muted">Configuration/type definition file</p></section>`;
        }

        const entityHtml = entities
          .map((entity) => {
            const entityHref = `../entities/${entityPageMap.get(entity.id)}`;
            return `<div class="entity-block"><h3>${escapeHtml(entity.name)} <span class="kind-badge">${escapeHtml(entity.kind)}</span></h3><p class="explanation">${escapeHtml(entity.explanation.text)}</p><p class="meta"><a href="${entityHref}">View source</a></p></div>`;
          })
          .join("\n");

        return `<section class="card"><h2><a href="${fileHref}">${escapeHtml(file?.path ?? filePath)}</a></h2>${entityHtml}</section>`;
      })
      .join("\n");

    const domainHtml = `${baseHead(`${domain.emoji} ${domain.name}`, "../")}
<section class="card">
  <h1>${escapeHtml(`${domain.emoji} ${domain.name}`)}</h1>
  <p class="muted">${escapeHtml(domain.description)}</p>
</section>
${fileBlocks}
${baseFoot()}`;

    fs.writeFileSync(path.join(domainsDir, `${domain.slug}.html`), domainHtml, "utf8");
  }

  const domainCards = input.domains
    .map((domain) => {
      const fileCount = domain.files.length;
      const entityCount = input.entities.filter((e) => domain.files.includes(e.filePath)).length;
      return `<div class="domain-card" data-search="${escapeHtml(`${domain.name} ${domain.description}`)}"><span class="emoji">${escapeHtml(domain.emoji)}</span><h3>${escapeHtml(domain.name)}</h3><p>${escapeHtml(domain.description)}</p><p class="muted">${fileCount} files, ${entityCount} entities</p><p><a href="domains/${escapeHtml(domain.slug)}.html">Open domain</a></p></div>`;
    })
    .join("\n");

  const entityRows = input.entities
    .map((entity) => {
      const href = `entities/${entityPageMap.get(entity.id)}`;
      return `<tr data-search="${escapeHtml(`${entity.filePath} ${entity.name} ${entity.kind}`)}"><td><a href="${href}">${escapeHtml(entity.name)}</a></td><td>${escapeHtml(entity.kind)}</td><td>${escapeHtml(entity.filePath)}</td><td class="status-${entity.explanation.status}">${escapeHtml(entity.explanation.status)}</td></tr>`;
    })
    .join("\n");

  const apiRows = input.files
    .map((file) => {
      const pathValue = inferApiPath(file.path);
      if (!pathValue) return null;
      const route = input.routes.find((r) => r.filePath === file.path);
      const method = (route?.method ?? "GET").toUpperCase();
      const className = `method-${method.toLowerCase()}`;
      const desc = input.entities.find((e) => e.filePath === file.path)?.explanation.text ?? "Route handler";
      return { method, className, path: pathValue, file: file.path, desc };
    })
    .filter((v): v is { method: string; className: string; path: string; file: string; desc: string } => Boolean(v))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(
      (row) => `<tr><td><span class="method-badge ${row.className}">${escapeHtml(row.method)}</span></td><td>${escapeHtml(row.path)}</td><td>${escapeHtml(row.desc)}</td><td>${escapeHtml(row.file)}</td></tr>`,
    )
    .join("\n");

  const changelogSections = input.changelog.summaryText.includes("Initial snapshot")
    ? `<section class="card"><p>${escapeHtml(input.changelog.summaryText)}</p></section>`
    : `<section class="card"><h2>Added</h2><ul>${
        input.changelog.addedEntities
          .map((id) => `<li>${escapeHtml(input.entities.find((e) => e.id === id)?.name ?? id)}</li>`)
          .join("") || "<li>None</li>"
      }</ul></section>
<section class="card"><h2>Modified</h2><ul>${
        input.changelog.changedEntities
          .map((id) => `<li>${escapeHtml(input.entities.find((e) => e.id === id)?.name ?? id)}</li>`)
          .join("") || "<li>None</li>"
      }</ul></section>
<section class="card"><h2>Removed</h2><ul>${input.changelog.removedEntities.map((id) => `<li>${escapeHtml(id)}</li>`).join("") || "<li>None</li>"}</ul></section>`;

  const graphData = {
    nodes: input.files.map((file) => {
      const domain = fileToDomain.get(file.path);
      const entityCount = input.entities.filter((e) => e.filePath === file.path).length;
      return {
        id: file.path,
        label: file.path.split("/").slice(-2).join("/"),
        domain: domain?.name ?? "Other",
        entityCount,
        color: domainColorMap.get(domain?.name ?? "") ?? "#9ca3af",
        href: `files/${filePageMap.get(file.path)}`,
      };
    }),
    edges: input.files.flatMap((file) => file.imports.map((imp) => ({ source: file.path, target: imp }))),
    domains: input.domains.map((domain) => ({
      name: domain.name,
      color: domainColorMap.get(domain.name) ?? "#9ca3af",
      emoji: domain.emoji,
    })),
  };

  fs.writeFileSync(path.join(input.outDir, "graph-data.js"), `window.GRAPH_DATA = ${JSON.stringify(graphData, null, 2)};\n`, "utf8");

  const now = new Date().toISOString();

  const indexHtml = `${baseHead("Overview", "")}
<section class="card">
  <h1>Architecture Overview</h1>
  <p>${escapeHtml(input.projectSummary)}</p>
</section>
<section class="card">
  <h2>Domains</h2>
  <input id="search" type="search" placeholder="Search domains" style="width:100%;padding:10px;border-radius:8px;border:1px solid #243244;background:#0b1220;color:#e5e7eb;margin-bottom:12px" />
  <div class="grid">${domainCards}</div>
</section>
<footer class="muted">Generated ${escapeHtml(now)}</footer>
<script src="./app.js"></script>
${baseFoot()}`;

  const referenceHtml = `${baseHead("Developer Reference", "")}
<section class="card">
  <h1>Developer Reference</h1>
  <input id="search" type="search" placeholder="Search entities" style="width:100%;padding:10px;border-radius:8px;border:1px solid #243244;background:#0b1220;color:#e5e7eb;margin-bottom:12px" />
  <table class="table">
    <thead><tr><th>Name</th><th>Kind</th><th>File</th><th>Status</th></tr></thead>
    <tbody>${entityRows}</tbody>
  </table>
</section>
<script src="./app.js"></script>
${baseFoot()}`;

  const apiHtml = `${baseHead("API Reference", "")}
<section class="card">
  <h1>API Reference</h1>
  <table class="table">
    <thead><tr><th>Method</th><th>Path</th><th>Description</th><th>File</th></tr></thead>
    <tbody>${apiRows || '<tr><td colspan="4">No API routes inferred</td></tr>'}</tbody>
  </table>
</section>
${baseFoot()}`;

  const graphHtml = `${baseHead("Graph Explorer", "")}
<div class="graph-wrap">
  <div id="tooltip" class="graph-tooltip"></div>
  <div class="graph-legend" id="legend"></div>
  <svg id="graph" class="graph-container"></svg>
</div>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script src="graph-data.js"></script>
<script>
const data = window.GRAPH_DATA;
const svg = d3.select('#graph');
const width = window.innerWidth;
const height = Math.max(window.innerHeight - 60, 300);
svg.attr('viewBox', [0, 0, width, height]);
const g = svg.append('g');
const tooltip = document.getElementById('tooltip');

svg.call(d3.zoom().on('zoom', (event) => g.attr('transform', event.transform)));

const defs = svg.append('defs');
defs.append('marker')
  .attr('id', 'arrow')
  .attr('viewBox', '0 -5 10 10')
  .attr('refX', 20)
  .attr('refY', 0)
  .attr('markerWidth', 6)
  .attr('markerHeight', 6)
  .attr('orient', 'auto')
  .append('path')
  .attr('d', 'M0,-5L10,0L0,5')
  .attr('fill', '#6b7280');

const links = g.append('g').selectAll('line')
  .data(data.edges)
  .join('line')
  .attr('stroke', '#4b5563')
  .attr('stroke-opacity', 0.8)
  .attr('marker-end', 'url(#arrow)');

const nodes = g.append('g').selectAll('circle')
  .data(data.nodes)
  .join('circle')
  .attr('r', d => Math.max(8, Math.min(30, 8 + d.entityCount * 2)))
  .attr('fill', d => d.color)
  .style('cursor', 'pointer')
  .on('mouseover', (event, d) => {
    tooltip.style.display = 'block';
    tooltip.innerHTML = '<strong>' + d.id + '</strong><br/>Domain: ' + d.domain + '<br/>Entities: ' + d.entityCount;
  })
  .on('mousemove', (event) => {
    tooltip.style.left = (event.pageX + 12) + 'px';
    tooltip.style.top = (event.pageY + 12) + 'px';
  })
  .on('mouseout', () => tooltip.style.display = 'none')
  .on('click', (_, d) => window.location.href = d.href)
  .call(d3.drag()
    .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
    .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
    .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

const simulation = d3.forceSimulation(data.nodes)
  .force('link', d3.forceLink(data.edges).id(d => d.id).distance(110))
  .force('charge', d3.forceManyBody().strength(-320))
  .force('center', d3.forceCenter(width / 2, height / 2));

simulation.on('tick', () => {
  links
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  nodes
    .attr('cx', d => d.x)
    .attr('cy', d => d.y);
});

const legend = document.getElementById('legend');
legend.innerHTML = data.domains.map(d =>
  "<div class='graph-legend-item'><span class='graph-legend-dot' style='background:" + d.color + "'></span><span>" + d.emoji + " " + d.name + "</span></div>"
).join('');
</script>
${baseFoot()}`;

  const changelogHtml = `${baseHead("What Changed", "")}
<section class="card">
  <h1>What Changed</h1>
  <p class="muted">Generated ${escapeHtml(now)}</p>
</section>
${changelogSections}
${baseFoot()}`;

  fs.writeFileSync(path.join(input.outDir, "index.html"), indexHtml, "utf8");
  fs.writeFileSync(path.join(input.outDir, "reference.html"), referenceHtml, "utf8");
  fs.writeFileSync(path.join(input.outDir, "api.html"), apiHtml, "utf8");
  fs.writeFileSync(path.join(input.outDir, "graph.html"), graphHtml, "utf8");
  fs.writeFileSync(path.join(input.outDir, "changelog.html"), changelogHtml, "utf8");
}
