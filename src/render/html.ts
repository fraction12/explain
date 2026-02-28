import fs from "node:fs";
import path from "node:path";
import { ChangelogData, DependencyEdge, DomainGroup, Entity, RouteInfo } from "../types";
import { escapeHtml, sha256, slugify } from "../utils";

interface HtmlInput {
  outDir: string;
  projectName: string;
  entities: Entity[];
  files: Array<{ path: string; imports: string[]; exports: string[]; sourceUrl: string }>;
  routes: RouteInfo[];
  changelog: ChangelogData;
  projectSummary: string;
  domains: DomainGroup[];
  edges: DependencyEdge[];
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function pageTitle(title: string): string {
  return `${title} | Explain`;
}

function buildSidebar(projectName: string, assetPrefix: string, domains: DomainGroup[]): string {
  const domainLinks = domains
    .map((domain) => `<a href="${assetPrefix}domains/${domain.slug}.html" class="sidebar-link sidebar-indent">${escapeHtml(domain.emoji)} ${escapeHtml(domain.name)}</a>`)
    .join("\n");

  return `<aside class="sidebar">
  <div class="sidebar-brand"><a href="${assetPrefix}index.html">${escapeHtml(projectName)}</a></div>
  <nav class="sidebar-nav">
    <a href="${assetPrefix}index.html" class="sidebar-link">Overview</a>
    <div class="sidebar-section">
      <div class="sidebar-heading">Domains</div>
      ${domainLinks}
    </div>
    <div class="sidebar-section">
      <div class="sidebar-heading">Reference</div>
      <a href="${assetPrefix}api.html" class="sidebar-link">API Reference</a>
      <a href="${assetPrefix}graph.html" class="sidebar-link">Architecture Map</a>
      <a href="${assetPrefix}reference.html" class="sidebar-link">Developer Reference</a>
      <a href="${assetPrefix}changelog.html" class="sidebar-link">What Changed</a>
    </div>
  </nav>
</aside>`;
}

function baseHead(title: string, projectName: string, assetPrefix: string, domains: DomainGroup[], contentClass = "content"): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | ${escapeHtml(projectName)}</title>
  <link rel="stylesheet" href="${assetPrefix}styles.css" />
</head>
<body>
${buildSidebar(projectName, assetPrefix, domains)}
<main class="${contentClass}">`;
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

/* Sidebar */
.sidebar { position: fixed; top: 0; left: 0; width: 260px; height: 100vh; overflow-y: auto; background: #111827; border-right: 1px solid #243244; padding: 20px 0; z-index: 100; }
.sidebar-brand { padding: 0 20px 16px; border-bottom: 1px solid #243244; margin-bottom: 16px; }
.sidebar-brand a { color: #e5e7eb; text-decoration: none; font-weight: 700; font-size: 1.2em; }
.sidebar-nav { display: flex; flex-direction: column; }
.sidebar-link { display: block; padding: 8px 20px; color: #9ca3af; text-decoration: none; font-size: 0.9em; transition: color 0.2s, background 0.2s; }
.sidebar-link:hover { color: #7dd3fc; background: rgba(125, 211, 252, 0.05); }
.sidebar-indent { padding-left: 36px; font-size: 0.85em; }
.sidebar-heading { padding: 16px 20px 6px; font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
.content { margin-left: 260px; padding: 24px 32px; max-width: 900px; }
.content-wide { margin-left: 260px; padding: 24px 32px; max-width: none; }

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

/* Tree */
.tree-wrap { position: relative; border: 1px solid #243244; border-radius: 10px; background: rgba(11, 18, 32, 0.7); overflow: hidden; }
.tree-container { width: 100%; min-height: 700px; display: block; }
.tree-tooltip { position: absolute; background: rgba(17, 24, 39, 0.95); border: 1px solid #243244; border-radius: 8px; padding: 10px 14px; color: #e5e7eb; font-size: 0.85em; pointer-events: none; z-index: 200; display: none; }
.graph-sidebar {
  position: absolute;
  top: 0;
  right: 0;
  width: 300px;
  height: 100%;
  background: rgba(15, 23, 42, 0.97);
  border-left: 1px solid #334155;
  padding: 16px;
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 180ms ease-out;
  z-index: 150;
}
.graph-sidebar.open { transform: translateX(0%); }
.graph-sidebar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.graph-sidebar-close {
  background: transparent;
  border: 1px solid #334155;
  color: #e5e7eb;
  border-radius: 6px;
  width: 28px;
  height: 28px;
  cursor: pointer;
}
.graph-sidebar h3 { margin: 0 0 4px 0; }
.graph-sidebar h4 { margin: 14px 0 6px; color: #93c5fd; font-size: 0.9rem; }
.graph-sidebar ul { margin: 0; padding-left: 16px; }
.graph-sidebar li { margin-bottom: 8px; color: #d1d5db; }
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

function inferProjectName(input: HtmlInput): string {
  if (input.projectName?.trim()) return input.projectName.trim();
  const fromOutDir = path.basename(path.resolve(input.outDir));
  return fromOutDir || "project";
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

  const projectName = inferProjectName(input);

  const filePageMap = new Map<string, string>();
  for (const file of input.files) filePageMap.set(file.path, filePageName(file.path));

  const entityPageMap = new Map<string, string>();
  for (const entity of input.entities) entityPageMap.set(entity.id, entityPageName(entity));

  const palette = ["#34d399", "#7dd3fc", "#fbbf24", "#f87171", "#a78bfa", "#fb923c", "#f472b6", "#2dd4bf"];
  const domainColorMap = new Map<string, string>();
  input.domains.forEach((d, i) => domainColorMap.set(d.slug, palette[i % palette.length]));

  const fileToDomain = new Map<string, DomainGroup>();
  for (const domain of input.domains) {
    for (const file of domain.files) {
      fileToDomain.set(file, domain);
      const ext = path.extname(file);
      if (ext) fileToDomain.set(file.slice(0, -ext.length), domain);
    }
  }

  function resolveFile(filePath: string, map: Map<string, DomainGroup>): DomainGroup | undefined {
    const direct = map.get(filePath);
    if (direct) return direct;
    for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
      const resolved = map.get(filePath + ext);
      if (resolved) return resolved;
    }
    return undefined;
  }

  for (const file of input.files) {
    const fileEntities = input.entities.filter((entity) => entity.filePath === file.path);
    const rows = fileEntities
      .map((entity) => {
        const href = `../entities/${entityPageMap.get(entity.id)}`;
        return `<tr data-search="${escapeHtml(`${entity.name} ${entity.kind}`)}"><td><a href="${href}">${escapeHtml(entity.name)}</a></td><td>${escapeHtml(entity.kind)}</td><td>${entity.exported ? "yes" : "no"}</td></tr>`;
      })
      .join("\n");

    const html = `${baseHead(`File: ${file.path}`, projectName, "../", input.domains)}
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
    const html = `${baseHead(`Entity: ${entity.name}`, projectName, "../", input.domains)}
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

    const domainHtml = `${baseHead(`${domain.emoji} ${domain.name}`, projectName, "../", input.domains)}
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

  const businessDomains = input.domains.filter((domain) => domain.kind !== "foundation");
  const foundationDomains = input.domains.filter((domain) => domain.kind === "foundation");

  const treeData = {
    name: projectName,
    children: businessDomains.map((domain) => ({
      name: `${domain.emoji} ${domain.name}`,
      slug: domain.slug,
      kind: domain.kind,
      domainName: domain.name,
      emoji: domain.emoji,
      children: domain.files
        .filter((filePath, index, arr) => arr.indexOf(filePath) === index)
        .map((filePath) => ({
          name: path.basename(filePath).replace(path.extname(filePath), "") || filePath,
          file: filePath,
          href: `files/${filePageMap.get(filePath)}`,
        })),
    })),
    foundationDomains: foundationDomains.map((domain) => ({
      name: `${domain.emoji} ${domain.name}`,
      slug: domain.slug,
      kind: domain.kind,
      domainName: domain.name,
      emoji: domain.emoji,
    })),
  };

  const domainDepsMap = new Map<string, Set<string>>();
  const domainImportDetailsMap = new Map<string, Record<string, Array<{ from: string; to: string }>>>();

  for (const edge of input.edges) {
    const fromDomain = resolveFile(edge.from, fileToDomain);
    const toDomain = resolveFile(edge.to, fileToDomain);
    if (!fromDomain || !toDomain) continue;
    if (fromDomain.slug === toDomain.slug) continue;
    if (fromDomain.kind === "foundation") continue;
    if (toDomain.kind === "foundation") continue;

    if (!domainDepsMap.has(fromDomain.slug)) domainDepsMap.set(fromDomain.slug, new Set<string>());
    domainDepsMap.get(fromDomain.slug)?.add(toDomain.slug);

    if (!domainImportDetailsMap.has(fromDomain.slug)) domainImportDetailsMap.set(fromDomain.slug, {});
    const fromDetails = domainImportDetailsMap.get(fromDomain.slug) as Record<string, Array<{ from: string; to: string }>>;
    if (!fromDetails[toDomain.slug]) fromDetails[toDomain.slug] = [];
    fromDetails[toDomain.slug].push({ from: edge.from, to: edge.to });
  }

  const domainDependencies = Object.fromEntries(
    businessDomains.map((domain) => [domain.slug, Array.from(domainDepsMap.get(domain.slug) ?? [])]),
  );

  const domainImportDetails = Object.fromEntries(
    businessDomains.map((domain) => [domain.slug, (domainImportDetailsMap.get(domain.slug) ?? {}) as Record<string, Array<{ from: string; to: string }>>]),
  );

  const graphData = {
    tree: treeData,
    domainDependencies,
    domainImportDetails,
  };

  fs.writeFileSync(path.join(input.outDir, "tree-data.js"), `window.TREE_DATA = ${JSON.stringify(graphData, null, 2)};\n`, "utf8");

  const now = new Date().toISOString();

  const indexHtml = `${baseHead("Overview", projectName, "", input.domains)}
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

  const referenceHtml = `${baseHead("Developer Reference", projectName, "", input.domains)}
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

  const apiHtml = `${baseHead("API Reference", projectName, "", input.domains)}
<section class="card">
  <h1>API Reference</h1>
  <table class="table">
    <thead><tr><th>Method</th><th>Path</th><th>Description</th><th>File</th></tr></thead>
    <tbody>${apiRows || '<tr><td colspan="4">No API routes inferred</td></tr>'}</tbody>
  </table>
</section>
${baseFoot()}`;

  const graphHtml = `${baseHead("Architecture Map", projectName, "", input.domains, "content-wide")}
<section class="card">
  <h1>Architecture Map</h1>
  <p class="muted">Project, domains, and key capabilities by file.</p>
</section>
<div class="tree-wrap" id="graph-wrap">
  <div id="tooltip" class="tree-tooltip"></div>
  <aside id="domain-sidebar" class="graph-sidebar">
    <div class="graph-sidebar-header">
      <h3 id="sidebar-title">Domain</h3>
      <button id="sidebar-close" class="graph-sidebar-close" aria-label="Close">×</button>
    </div>
    <p id="sidebar-subtitle" class="muted"></p>
    <h4>Depends on</h4>
    <ul id="sidebar-depends"></ul>
    <h4>Depended on by</h4>
    <ul id="sidebar-reverse"></ul>
  </aside>
  <svg id="tree" class="tree-container"></svg>
</div>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script src="tree-data.js"></script>
<script>
const graphData = window.TREE_DATA;
const data = graphData.tree;
const domainDependencies = graphData.domainDependencies || {};
const domainImportDetails = graphData.domainImportDetails || {};
const domainColors = new Map(${JSON.stringify(input.domains.map((domain) => [domain.slug, domainColorMap.get(domain.slug) ?? "#9ca3af"]))});

const root = d3.hierarchy(data);
const leafCount = root.leaves().length;
const maxDepth = root.height;
const width = Math.max(1400, (maxDepth + 1) * 320 + 420);
const height = Math.max(820, leafCount * 32 + 340);
const margin = { top: 60, right: 320, bottom: 170, left: 110 };

const svg = d3.select('#tree')
  .attr('viewBox', [0, 0, width, height])
  .attr('preserveAspectRatio', 'xMidYMid meet');

const zoomLayer = svg.append('g');
const content = zoomLayer.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
const depsLayer = content.append('g').attr('class', 'deps-layer');
const treeLayer = content.append('g').attr('class', 'tree-layer');
const foundationLayer = content.append('g').attr('class', 'foundation-layer');

const zoomBehavior = d3.zoom().scaleExtent([0.4, 2.5]).on('zoom', (event) => zoomLayer.attr('transform', event.transform));
svg.call(zoomBehavior);

const treeHeight = height - margin.top - margin.bottom - 120;
const treeWidth = width - margin.left - margin.right;
const tree = d3.tree().nodeSize([42, 300]);
tree(root);

const link = d3.linkHorizontal().x(d => d.y).y(d => d.x);
treeLayer.append('g')
  .selectAll('path')
  .data(root.links())
  .join('path')
  .attr('fill', 'none')
  .attr('stroke', '#4b5563')
  .attr('stroke-width', 1.5)
  .attr('d', link);

const tooltip = document.getElementById('tooltip');
const sidebar = document.getElementById('domain-sidebar');
const sidebarTitle = document.getElementById('sidebar-title');
const sidebarSubtitle = document.getElementById('sidebar-subtitle');
const sidebarDepends = document.getElementById('sidebar-depends');
const sidebarReverse = document.getElementById('sidebar-reverse');
const sidebarClose = document.getElementById('sidebar-close');

const domainNodeBySlug = new Map();

const node = treeLayer.append('g')
  .selectAll('g')
  .data(root.descendants())
  .join('g')
  .attr('transform', d => 'translate(' + d.y + ',' + d.x + ')')
  .style('cursor', d => d.depth > 0 ? 'pointer' : 'default')
  .on('click', (event, d) => {
    event.stopPropagation();
    if (d.depth === 1 && d.data.slug) {
      selectDomain(d.data.slug);
      return;
    }
    if (d.depth === 2 && d.data.href) window.location.href = d.data.href;
  })
  .on('mouseover', (event, d) => {
    if (d.depth !== 2 || !d.data.file) return;
    tooltip.style.display = 'block';
    tooltip.textContent = d.data.file;
  })
  .on('mousemove', (event) => {
    tooltip.style.left = (event.pageX + 12) + 'px';
    tooltip.style.top = (event.pageY + 12) + 'px';
  })
  .on('mouseout', () => { tooltip.style.display = 'none'; });

node.each((d, i, n) => {
  if (d.depth === 1 && d.data.slug) domainNodeBySlug.set(d.data.slug, d);
});

node.append('circle')
  .attr('r', d => d.depth === 0 ? 12 : d.depth === 1 ? 10 : 5)
  .attr('fill', d => {
    if (d.depth === 0) return '#ffffff';
    if (d.depth === 1) return domainColors.get(d.data.slug) || '#9ca3af';
    return domainColors.get(d.parent?.data?.slug) || '#9ca3af';
  })
  .attr('stroke', '#111827')
  .attr('stroke-width', 1.5)
  .attr('class', d => d.depth === 1 ? 'business-domain-node' : 'tree-node-circle')
  .attr('data-slug', d => d.data?.slug || '');

node.append('text')
  .attr('x', d => d.depth === 0 ? -16 : 10)
  .attr('text-anchor', d => d.depth === 0 ? 'end' : 'start')
  .attr('dominant-baseline', 'middle')
  .style('fill', '#ffffff')
  .style('font-size', d => d.depth === 1 ? '13px' : d.depth === 2 ? '11px' : '14px')
  .text(d => {
    const label = d.data.name || "";
    return d.depth === 1 && label.length > 25 ? label.slice(0, 22) + "..." : label;
  })
  .append("title")
  .text(d => d.data.name || "");

const foundationDomains = data.foundationDomains || [];
const foundationY = treeHeight + 70;
const foundationBarHeight = 70;
foundationLayer.append('rect')
  .attr('x', -20)
  .attr('y', foundationY - foundationBarHeight / 2)
  .attr('width', treeWidth + 40)
  .attr('height', foundationBarHeight)
  .attr('rx', 12)
  .attr('fill', 'rgba(30,41,59,0.7)')
  .attr('stroke', '#475569')
  .attr('stroke-width', 1.2);

foundationLayer.append('text')
  .attr('x', 0)
  .attr('y', foundationY - foundationBarHeight / 2 - 10)
  .attr('fill', '#cbd5e1')
  .style('font-size', '12px')
  .text('Foundation & Shared Services');

const foundationSpacing = foundationDomains.length > 0 ? (treeWidth - 120) / (foundationDomains.length + 1) : treeWidth;
const foundationNodes = foundationLayer.append('g')
  .selectAll('g')
  .data(foundationDomains)
  .join('g')
  .attr('transform', (_, i) => 'translate(' + (60 + (i + 1) * foundationSpacing) + ',' + foundationY + ')')
  .style('cursor', 'pointer')
  .on('click', (event, d) => {
    event.stopPropagation();
    selectDomain(d.slug);
  });

foundationNodes.append('circle')
  .attr('r', 10)
  .attr('fill', d => domainColors.get(d.slug) || '#94a3b8')
  .attr('stroke', '#0f172a')
  .attr('stroke-width', 1.5);

foundationNodes.append('text')
  .attr('x', 14)
  .attr('y', 1)
  .attr('dominant-baseline', 'middle')
  .style('font-size', '12px')
  .style('fill', '#e2e8f0')
  .text(d => d.domainName || d.name);

const markers = depsLayer.append('defs');
markers.append('marker')
  .attr('id', 'dep-arrow-forward')
  .attr('viewBox', '0 -5 10 10')
  .attr('refX', 9)
  .attr('refY', 0)
  .attr('markerWidth', 6)
  .attr('markerHeight', 6)
  .attr('orient', 'auto')
  .append('path')
  .attr('d', 'M0,-5L10,0L0,5')
  .attr('fill', '#f59e0b');

markers.append('marker')
  .attr('id', 'dep-arrow-reverse')
  .attr('viewBox', '0 -5 10 10')
  .attr('refX', 9)
  .attr('refY', 0)
  .attr('markerWidth', 6)
  .attr('markerHeight', 6)
  .attr('orient', 'auto')
  .append('path')
  .attr('d', 'M0,-5L10,0L0,5')
  .attr('fill', '#fb923c');

const depLinesGroup = depsLayer.append('g').attr('class', 'dep-lines');
let activeSlug = null;

function nodePositionBySlug(slug) {
  const domainNode = domainNodeBySlug.get(slug);
  if (!domainNode) return null;
  return { x: domainNode.y, y: domainNode.x };
}

function pathBetween(from, to) {
  const dx = to.x - from.x;
  const c1x = from.x + Math.max(40, dx * 0.45);
  const c2x = to.x - Math.max(40, dx * 0.45);
  return 'M' + from.x + ',' + from.y + ' C' + c1x + ',' + from.y + ' ' + c2x + ',' + to.y + ' ' + to.x + ',' + to.y;
}

function resetSelection() {
  activeSlug = null;
  depLinesGroup.selectAll('*').remove();
  d3.selectAll('.business-domain-node')
    .attr('stroke', '#111827')
    .attr('stroke-width', 1.5);
  sidebar.classList.remove('open');
}

function listItemText(pair) {
  const [targetSlug, details] = pair;
  const targetNode = (root.descendants().find(d => d.depth === 1 && d.data.slug === targetSlug) || {}).data;
  const targetName = targetNode && targetNode.name ? targetNode.name : targetSlug;
  const samples = (details || []).slice(0, 5).map(d => d.from + ' → ' + d.to).join('; ');
  return targetName + (samples ? ' — imports: ' + samples : '');
}

function renderSidebar(slug) {
  const domainNode = (root.descendants().find(d => d.depth === 1 && d.data.slug === slug) || {}).data;
  const dependsOn = domainDependencies[slug] || [];
  const dependedOnBy = Object.entries(domainDependencies)
    .filter(([, deps]) => (deps || []).includes(slug))
    .map(([s]) => s);

  sidebarTitle.textContent = (domainNode?.emoji || '') + ' ' + (domainNode?.domainName || slug);
  sidebarSubtitle.textContent = domainNode?.name || '';

  sidebarDepends.innerHTML = '';
  if (dependsOn.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'None';
    sidebarDepends.appendChild(li);
  } else {
    dependsOn.forEach((targetSlug) => {
      const li = document.createElement('li');
      const details = ((domainImportDetails[slug] || {})[targetSlug] || []);
      li.textContent = listItemText([targetSlug, details]);
      sidebarDepends.appendChild(li);
    });
  }

  sidebarReverse.innerHTML = '';
  if (dependedOnBy.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'None';
    sidebarReverse.appendChild(li);
  } else {
    dependedOnBy.forEach((sourceSlug) => {
      const li = document.createElement('li');
      const details = ((domainImportDetails[sourceSlug] || {})[slug] || []);
      li.textContent = listItemText([sourceSlug, details]);
      sidebarReverse.appendChild(li);
    });
  }

  sidebar.classList.add('open');
}

function selectDomain(slug) {
  activeSlug = slug;
  depLinesGroup.selectAll('*').remove();

  d3.selectAll('.business-domain-node')
    .attr('stroke', '#111827')
    .attr('stroke-width', 1.5);
  d3.selectAll('.business-domain-node[data-slug="' + slug + '"]')
    .attr('stroke', '#f8fafc')
    .attr('stroke-width', 3);

  const source = nodePositionBySlug(slug);
  if (!source) return;

  const outgoing = domainDependencies[slug] || [];
  outgoing.forEach((targetSlug) => {
    const target = nodePositionBySlug(targetSlug);
    if (!target) return;
    depLinesGroup.append('path')
      .attr('d', pathBetween(source, target))
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6 5')
      .attr('marker-end', 'url(#dep-arrow-forward)');
  });

  Object.entries(domainDependencies)
    .filter(([, deps]) => (deps || []).includes(slug))
    .forEach(([otherSlug]) => {
      const from = nodePositionBySlug(otherSlug);
      if (!from) return;
      depLinesGroup.append('path')
        .attr('d', pathBetween(from, source))
        .attr('fill', 'none')
        .attr('stroke', '#fb923c')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '2 6')
        .attr('marker-end', 'url(#dep-arrow-reverse)');
    });

  renderSidebar(slug);
}

svg.on('click', () => resetSelection());
sidebarClose.addEventListener('click', (event) => {
  event.stopPropagation();
  resetSelection();
});

const bounds = content.node().getBBox();
const scale = Math.min(1.08, Math.min((width - 40) / (bounds.width + 40), (height - 40) / (bounds.height + 40)));
const tx = (width / 2) - ((bounds.x + bounds.width / 2) * scale);
const ty = (height / 2) - ((bounds.y + bounds.height / 2) * scale);
svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
</script>
${baseFoot()}`;

  const changelogHtml = `${baseHead("What Changed", projectName, "", input.domains)}
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
