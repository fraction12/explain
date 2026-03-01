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

function stripEmojis(value: string): string {
  return value.replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();
}

function cleanDomainName(domain: DomainGroup): string {
  return stripEmojis(domain.name);
}

function cleanDomainDescription(domain: DomainGroup): string {
  return stripEmojis(domain.description);
}

function domainCardIcon(domain: DomainGroup): string {
  const text = `${domain.slug} ${cleanDomainName(domain)} ${cleanDomainDescription(domain)}`.toLowerCase();
  if (/(auth|login|identity|session|token)/.test(text)) return "◉";
  if (/(config|settings|option|env)/.test(text)) return "◆";
  if (/(api|http|route|endpoint)/.test(text)) return "◇";
  if (/(security|guard|permission|policy|risk|safe)/.test(text)) return "▣";
  if (/(data|store|db|cache)/.test(text)) return "▦";
  return domain.kind === "foundation" ? "□" : "○";
}

function buildSidebar(projectName: string, assetPrefix: string, domains: DomainGroup[]): string {
  const businessDomains = domains.filter((d) => d.kind !== "foundation");
  const foundationDomains = domains.filter((d) => d.kind === "foundation");

  const businessLinks = businessDomains
    .map(
      (domain) =>
        `<a href="${assetPrefix}domains/${domain.slug}.html" class="sidebar-link sidebar-indent"><span class="sidebar-link-icon">◆</span><span class="sidebar-link-text">${escapeHtml(cleanDomainName(domain))}</span></a>`,
    )
    .join("\n");

  const foundationLinks = foundationDomains
    .map(
      (domain) =>
        `<a href="${assetPrefix}domains/${domain.slug}.html" class="sidebar-link sidebar-indent"><span class="sidebar-link-icon">◆</span><span class="sidebar-link-text">${escapeHtml(cleanDomainName(domain))}</span></a>`,
    )
    .join("\n");

  return `<aside class="sidebar" id="main-sidebar">
  <div class="sidebar-brand">
    <a href="${assetPrefix}index.html" class="sidebar-brand-link"><span class="sidebar-link-text">${escapeHtml(projectName)}</span></a>
    <button class="sidebar-toggle" id="sidebar-toggle" title="Collapse sidebar" aria-label="Toggle sidebar">&#8249;</button>
  </div>
  <nav class="sidebar-nav">
    <a href="${assetPrefix}index.html" class="sidebar-link"><span class="sidebar-link-icon">○</span><span class="sidebar-link-text">Overview</span></a>
    <div class="sidebar-section">
      <button class="sidebar-section-toggle" data-section-target="sidebar-business-domains" aria-expanded="true"><span class="sidebar-chevron">▾</span><span class="sidebar-heading-full">Domains</span><span class="sidebar-heading-abbr">D</span></button>
      <div id="sidebar-business-domains" class="sidebar-section-links">${businessLinks}</div>
    </div>
    ${
      foundationDomains.length
        ? `<div class="sidebar-section"><button class="sidebar-section-toggle" data-section-target="sidebar-foundation-domains" aria-expanded="true"><span class="sidebar-chevron">▾</span><span class="sidebar-heading-full">Infrastructure</span><span class="sidebar-heading-abbr">I</span></button><div id="sidebar-foundation-domains" class="sidebar-section-links">${foundationLinks}</div></div>`
        : ""
    }
    <div class="sidebar-section">
      <div class="sidebar-heading"><span class="sidebar-heading-full">Reference</span><span class="sidebar-heading-abbr">R</span></div>
      <a href="${assetPrefix}api.html" class="sidebar-link"><span class="sidebar-link-icon">#</span><span class="sidebar-link-text">API Reference</span></a>
      <a href="${assetPrefix}graph.html" class="sidebar-link"><span class="sidebar-link-icon">◇</span><span class="sidebar-link-text">Architecture Map</span></a>
      <a href="${assetPrefix}reference.html" class="sidebar-link"><span class="sidebar-link-icon">▦</span><span class="sidebar-link-text">Developer Reference</span></a>
      <a href="${assetPrefix}changelog.html" class="sidebar-link"><span class="sidebar-link-icon">●</span><span class="sidebar-link-text">What Changed</span></a>
    </div>
  </nav>
</aside>`;
}

function baseHead(title: string, projectName: string, assetPrefix: string, domains: DomainGroup[], opts: { breadcrumb?: string; contentClass?: string } = {}): string {
  const contentClass = opts.contentClass ?? "content";
  const breadcrumb = opts.breadcrumb;
  const breadcrumbLabel = breadcrumb ? escapeHtml(breadcrumb) : "Overview";
  const breadcrumbHtml = breadcrumb
    ? `<nav class="breadcrumb"><a href="${assetPrefix}index.html">Overview</a><span class="breadcrumb-sep">›</span><span>${breadcrumbLabel}</span></nav>`
    : `<nav class="breadcrumb"><span>${breadcrumbLabel}</span></nav>`;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | ${escapeHtml(projectName)}</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%230f172a'/><text x='50' y='68' text-anchor='middle' font-family='Arial,sans-serif' font-size='56' fill='white'>E</text></svg>" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link id="hljs-theme-light" rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github.min.css" />
  <link id="hljs-theme-dark" rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github-dark.min.css" disabled />
  <link rel="stylesheet" href="${assetPrefix}styles.css" />
  <script src="https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/lib/common.min.js"></script>
  <script src="${assetPrefix}search-index.js"></script>
  <script src="${assetPrefix}app.js" defer></script>
</head>
<body data-asset-prefix="${assetPrefix}">
<button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Open navigation">&#9776;</button>
<div class="sidebar-backdrop" id="sidebar-backdrop"></div>
${buildSidebar(projectName, assetPrefix, domains)}
<main class="${contentClass}">
  <header class="top-bar">
    <div class="top-bar-breadcrumbs">${breadcrumbHtml}</div>
    <button class="topbar-theme-toggle" data-theme-toggle title="Toggle theme" aria-label="Toggle theme">◐</button>
  </header>
  <div class="content-layout">
    <div class="content-main">`;
}

function baseFoot(tocHtml?: string): string {
  return `</div>${tocHtml ? `<nav class="right-toc">${tocHtml}</nav>` : ""}
  </div>
</main>
<footer class="site-footer">
  <div class="footer-content">
    <span>Generated by <strong>Explain</strong></span>
    <span class="footer-sep">·</span>
    <span>${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
  </div>
</footer>
<script>
function normalizePathname(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

function syncHighlightTheme() {
  var isDark = document.documentElement.classList.contains("dark");
  var lightTheme = document.getElementById("hljs-theme-light");
  var darkTheme = document.getElementById("hljs-theme-dark");
  if (lightTheme) lightTheme.disabled = isDark;
  if (darkTheme) darkTheme.disabled = !isDark;
}

function enhanceCodeBlocks(root) {
  var scope = root || document;
  if (!(scope instanceof Element || scope instanceof Document)) return;
  scope.querySelectorAll("pre").forEach(function(pre) {
    var code = pre.querySelector("code");
    if (!code) {
      code = document.createElement("code");
      code.textContent = pre.textContent || "";
      pre.textContent = "";
      pre.appendChild(code);
    }
    if (!code.classList.contains("hljs") && window.hljs && typeof window.hljs.highlightElement === "function") {
      window.hljs.highlightElement(code);
    }

    if (pre.querySelector(".code-copy-btn")) return;
    var copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "code-copy-btn";
    copyButton.textContent = "Copy";
    copyButton.setAttribute("aria-label", "Copy code");
    copyButton.addEventListener("click", function() {
      var raw = code ? code.textContent || "" : "";
      if (!raw) return;
      navigator.clipboard.writeText(raw).then(function() {
        copyButton.textContent = "Copied!";
        copyButton.classList.add("copied");
        setTimeout(function() {
          copyButton.textContent = "Copy";
          copyButton.classList.remove("copied");
        }, 1200);
      });
    });
    pre.appendChild(copyButton);
  });
}

window.__explainEnhanceCodeBlocks = enhanceCodeBlocks;
syncHighlightTheme();
enhanceCodeBlocks(document);

function updateActiveSidebarLinks(pathname) {
  var currentPath = normalizePathname(pathname || window.location.pathname);
  document.querySelectorAll(".sidebar-link").forEach(function(link) {
    var href = link.getAttribute("href");
    if (!href) {
      link.classList.remove("active");
      return;
    }
    var resolved = new URL(href, window.location.href);
    link.classList.toggle("active", normalizePathname(resolved.pathname) === currentPath);
  });
}

function initRightToc() {
  var toc = document.querySelector(".right-toc");
  if (!toc) return;
  var links = Array.from(toc.querySelectorAll("a[href^='#']"));
  if (!links.length) return;

  function setActive(hash) {
    links.forEach(function(link) {
      var isActive = hash && link.getAttribute("href") === hash;
      link.classList.toggle("active", !!isActive);
    });
  }

  links.forEach(function(link) {
    link.addEventListener("click", function() {
      setActive(link.getAttribute("href"));
    });
  });

  if (window.location.hash) {
    setActive(window.location.hash);
    return;
  }

  var sections = links
    .map(function(link) {
      var hash = link.getAttribute("href") || "";
      if (!hash || hash.charAt(0) !== "#") return null;
      var id = hash.slice(1);
      var el = document.getElementById(id);
      if (!el) return null;
      return { hash: hash, el: el };
    })
    .filter(Boolean);

  if (!sections.length || !("IntersectionObserver" in window)) {
    if (links[0]) setActive(links[0].getAttribute("href"));
    return;
  }

  var observer = new IntersectionObserver(
    function(entries) {
      var visible = entries
        .filter(function(entry) { return entry.isIntersecting; })
        .sort(function(a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
      if (!visible.length) return;
      var id = visible[0].target.getAttribute("id");
      if (!id) return;
      setActive("#" + id);
    },
    { rootMargin: "-25% 0px -60% 0px", threshold: [0, 1] },
  );

  sections.forEach(function(section) {
    observer.observe(section.el);
  });
  setActive(links[0].getAttribute("href"));
}

updateActiveSidebarLinks(window.location.pathname);
initRightToc();

// Sidebar collapse toggle
(function() {
  var sidebar = document.getElementById('main-sidebar');
  var btn = document.getElementById('sidebar-toggle');
  if (!sidebar || !btn) return;
  var key = 'explain-sidebar-collapsed';
  var collapsed = localStorage.getItem(key) === '1';
  if (collapsed) { sidebar.classList.add('collapsed'); document.body.classList.add('sidebar-collapsed'); btn.title = 'Expand sidebar'; }
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    collapsed = !collapsed;
    sidebar.classList.toggle('collapsed', collapsed);
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    btn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    localStorage.setItem(key, collapsed ? '1' : '0');
  });
})();

// Collapsible sidebar sections
(function() {
  document.querySelectorAll('.sidebar-section-toggle').forEach(function(btn) {
    var targetId = btn.getAttribute('data-section-target');
    if (!targetId) return;
    var target = document.getElementById(targetId);
    if (!target) return;

    btn.addEventListener('click', function() {
      var expanded = btn.getAttribute('aria-expanded') !== 'false';
      btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      target.classList.toggle('collapsed', expanded);
    });
  });
})();

// Mobile hamburger menu toggle
(function() {
  var menuBtn = document.getElementById('mobile-menu-btn');
  var backdrop = document.getElementById('sidebar-backdrop');
  var sidebar = document.getElementById('main-sidebar');
  if (!menuBtn || !backdrop || !sidebar) return;

  function openSidebar() {
    document.body.classList.add('sidebar-overlay-open');
    menuBtn.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-overlay-open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  menuBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (document.body.classList.contains('sidebar-overlay-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  backdrop.addEventListener('click', closeSidebar);

  // Close when a sidebar link is clicked (SPA nav or regular)
  sidebar.querySelectorAll('.sidebar-link').forEach(function(link) {
    link.addEventListener('click', function() {
      if (window.innerWidth <= 480) closeSidebar();
    });
  });
})();

// Lightweight SPA router for internal HTML navigation
(function() {
  var FADE_MS = 120;

  function getMain() {
    return document.querySelector(".content, .content-wide");
  }

  function hasInlineScripts(container) {
    return !!container && container.querySelector("script:not([src])");
  }

  function isNavigableHtmlUrl(url) {
    if (url.origin !== window.location.origin) return false;
    if (!/\.html(?:$|[?#])/i.test(url.pathname + url.search + url.hash)) return false;
    return true;
  }

  function shouldHandleLink(link, event) {
    if (!link) return false;
    if (event.defaultPrevented) return false;
    if (event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target && link.target !== "_self") return false;
    if (link.hasAttribute("download")) return false;
    if (link.getAttribute("rel") === "external") return false;
    var href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
    return true;
  }

  async function fetchPage(url) {
    var response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw new Error("Failed to load " + url);
    var text = await response.text();
    var doc = new DOMParser().parseFromString(text, "text/html");
    var nextMain = doc.querySelector(".content, .content-wide");
    if (!nextMain) return null;
    if (hasInlineScripts(nextMain)) return null;
    return {
      title: doc.title || document.title,
      className: nextMain.className,
      html: nextMain.innerHTML,
      path: url.pathname + url.search + url.hash,
    };
  }

  var navToken = 0;

  async function navigate(url, push) {
    if (!isNavigableHtmlUrl(url)) {
      window.location.href = url.href;
      return;
    }
    var currentUrl = new URL(window.location.href);
    if (normalizePathname(url.pathname) === normalizePathname(currentUrl.pathname) && url.search === currentUrl.search) {
      if (url.hash !== currentUrl.hash) window.location.hash = url.hash;
      return;
    }
    var main = getMain();
    if (!main) {
      window.location.href = url.href;
      return;
    }

    var token = ++navToken;
    var next;
    try {
      next = await fetchPage(url.href);
    } catch (_) {
      window.location.href = url.href;
      return;
    }
    if (!next) {
      window.location.href = url.href;
      return;
    }
    if (token !== navToken) return;

    main.style.transition = "opacity " + FADE_MS + "ms ease";
    main.style.opacity = "0";
    await new Promise(function(resolve) { setTimeout(resolve, FADE_MS); });
    if (token !== navToken) return;

    main.className = next.className;
    main.innerHTML = next.html;
    if (window.__explainEnhanceCodeBlocks) {
      window.__explainEnhanceCodeBlocks(main);
    }
    document.title = next.title;

    if (push) {
      window.history.pushState({ path: next.path }, "", next.path);
    }
    updateActiveSidebarLinks(url.pathname);
    initRightToc();
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    var updatedMain = getMain();
    if (!updatedMain) return;
    updatedMain.style.transition = "opacity " + FADE_MS + "ms ease";
    updatedMain.style.opacity = "0";
    void updatedMain.offsetWidth;
    updatedMain.style.opacity = "1";
  }

  document.addEventListener("click", function(event) {
    var link = event.target instanceof Element ? event.target.closest("a") : null;
    if (!shouldHandleLink(link, event)) return;
    var url = new URL(link.href, window.location.href);
    if (!isNavigableHtmlUrl(url)) return;
    event.preventDefault();
    navigate(url, true);
  });

  window.addEventListener("popstate", function() {
    navigate(new URL(window.location.href), false);
  });
})();
</script>
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
  --bg: #f8f8f7;
  --panel: #ffffff;
  --panel-2: #f3f3f1;
  --text: #232323;
  --muted: #6f6f6b;
  --link: var(--text);
  --accent: #7a7a76;
  --border: rgba(18, 18, 18, 0.08);
  --border-strong: rgba(18, 18, 18, 0.14);
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.65;
  background: var(--bg);
  color: var(--text);
  padding-left: 220px;
  transition: padding-left 220ms ease;
}
a {
  color: var(--link);
  font-weight: 500;
  text-decoration: none;
}
a:hover { text-decoration: underline; }
small, .muted { color: var(--muted); opacity: 0.7; }
pre {
  white-space: pre;
  position: relative;
  overflow: auto;
  background: var(--panel-2);
  border-radius: 6px;
  padding: var(--space-md);
  border: 1px solid var(--border);
}
pre, code { font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.6; }
pre code {
  display: block;
  background: transparent !important;
  padding: 0 !important;
  color: inherit;
}
pre code.hljs { background: transparent !important; }
.code-copy-btn {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  border: 0;
  border-radius: 4px;
  padding: var(--space-xs) var(--space-sm);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  line-height: 1.4;
  color: rgba(35,35,35,0.88);
  background: rgba(248,248,247,0.88);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.16s ease, background 0.16s ease, color 0.16s ease;
}
pre:hover .code-copy-btn,
pre:focus-within .code-copy-btn { opacity: 1; }
.code-copy-btn:hover { background: rgba(238,238,236,0.96); color: #121212; }
.code-copy-btn.copied { color: #494946; }
h1 { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; margin: 0 0 var(--space-sm) 0; }
h2 { font-size: 21px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.2; margin: var(--space-lg) 0 var(--space-sm) 0; color: var(--text); }
h3 { font-size: 18px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.25; margin: var(--space-md) 0 var(--space-sm) 0; }
p { margin: 0 0 var(--space-md) 0; max-width: 720px; }
.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table th { text-align: left; color: #72726e; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; padding: var(--space-sm) var(--space-md); border-bottom: 2px solid var(--border-strong); opacity: 0.9; }
.table td { padding: 16px var(--space-md); border-bottom: 1px solid var(--border); vertical-align: top; }
.table tbody tr td { background: rgba(18, 18, 18, 0.01); transition: background 0.15s ease; }
.table tbody tr:nth-child(even) td { background: rgba(18, 18, 18, 0.03); }
.table tbody tr:hover td { background: rgba(18, 18, 18, 0.05); }
.table td:last-child { max-width: 480px; }
.table-api td:nth-child(3) { max-width: 56ch; }
.table-reference .table-section-row td {
  padding: 10px var(--space-md);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #72726e;
  background: rgba(18, 18, 18, 0.05);
  border-bottom-color: var(--border-strong);
}
.badge { font-size: 11px; font-weight: 500; opacity: 0.7; }
.status-failed, .status-ok, .status-cached { color: var(--muted); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-md); }
.card { background: var(--panel); border-radius: 6px; padding: var(--space-lg); margin-bottom: var(--space-lg); border: 1px solid var(--border); }

/* Sidebar */
.sidebar {
  position: fixed; top: 0; left: 0; width: 220px; height: 100vh;
  overflow-y: auto; overflow-x: hidden;
  background: #ffffff;
  border-right: 1px solid var(--border);
  z-index: 100;
  transition: width 220ms ease;
  display: flex; flex-direction: column;
}
.sidebar.collapsed { width: 60px; }
.sidebar-brand {
  display: flex; align-items: center; gap: var(--space-sm);
  padding: var(--space-lg) var(--space-lg) var(--space-md);
  margin-bottom: var(--space-sm);
  min-height: 48px; flex-shrink: 0; position: relative;
  border-bottom: 1px solid var(--border);
}
.sidebar-brand-link { color: var(--text); text-decoration: none; font-weight: 600; font-size: 14px; white-space: nowrap; flex: 1; min-width: 0; }
.sidebar-toggle {
  background: transparent; border: none; color: #858581;
  cursor: pointer; font-size: 18px; line-height: 1;
  padding: var(--space-xs); border-radius: 4px; flex-shrink: 0;
  transition: color 0.15s, transform 220ms ease;
}
.sidebar-toggle:hover { color: var(--text); background: rgba(18,18,18,0.05); }
.sidebar.collapsed .sidebar-toggle { transform: rotate(180deg); }
.sidebar-nav { display: flex; flex-direction: column; flex: 1; gap: 2px; padding-bottom: var(--space-md); }
.sidebar-link {
  display: flex; align-items: center; gap: var(--space-sm);
  min-height: 38px;
  padding: var(--space-sm) var(--space-lg); color: #6f6f6b; text-decoration: none;
  font-size: 14px; white-space: nowrap; overflow: hidden;
  transition: color 0.15s, background 0.15s;
}
.sidebar-link:hover { color: var(--text); background: rgba(18,18,18,0.04); text-decoration: none; }
.sidebar-link.active { color: var(--text); background: rgba(18,18,18,0.06); }
.sidebar-link-icon { flex-shrink: 0; width: 20px; text-align: center; font-size: 14px; opacity: 0.75; }
.sidebar-link-text { overflow: hidden; text-overflow: ellipsis; transition: opacity 150ms ease, max-width 220ms ease; max-width: 160px; }
.sidebar-indent { padding-left: calc(var(--space-lg) + 14px); font-size: 14px; }
.sidebar-heading {
  padding: var(--space-lg) var(--space-lg) var(--space-xs); font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.1em; color: #8b8b87;
  white-space: nowrap; overflow: hidden;
}
.sidebar-section-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  background: transparent;
  border: 0;
  color: #8b8b87;
  cursor: pointer;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: var(--space-lg) var(--space-lg) var(--space-xs);
  text-align: left;
}
.sidebar-section-toggle:hover { color: #4b4b47; }
.sidebar-chevron { width: 14px; text-align: center; font-size: 10px; line-height: 1; }
.sidebar-section-toggle[aria-expanded="false"] .sidebar-chevron { transform: rotate(-90deg); }
.sidebar-section-links.collapsed { display: none; }
.sidebar-heading-abbr { display: none; }
.sidebar.collapsed .sidebar-link-text,
.sidebar.collapsed .sidebar-brand-link,
.sidebar.collapsed .sidebar-heading-full { opacity: 0; max-width: 0; overflow: hidden; pointer-events: none; }
.sidebar.collapsed .sidebar-heading-abbr { display: block; }
.sidebar.collapsed .sidebar-link { padding-left: 0; justify-content: center; }
.sidebar.collapsed .sidebar-indent { padding-left: 0; }
.sidebar.collapsed .sidebar-link-icon { width: auto; }
body.sidebar-collapsed { padding-left: 60px; }

.top-bar {
  position: sticky;
  top: 0;
  z-index: 40;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  padding: 0 var(--space-xl);
}
.topbar-theme-toggle {
  background: transparent;
  border: 0;
  border-radius: 4px;
  color: #6f6f6b;
  cursor: pointer;
  font-size: 15px;
  width: 28px;
  height: 28px;
}
.topbar-theme-toggle:hover { color: var(--text); background: rgba(18,18,18,0.05); }
.content-layout {
  display: flex;
  justify-content: center;
  gap: var(--space-xl);
  width: 100%;
  padding: var(--space-xl);
}
.content-main {
  width: 100%;
}
.content { margin: 0 auto; max-width: 680px; width: 100%; }
.content-wide { margin: 0 auto; max-width: 1040px; width: 100%; }

.right-toc {
  position: fixed;
  right: 24px;
  top: 96px;
  width: 220px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  padding-left: 12px;
  border-left: 1px solid var(--border);
  font-size: 13px;
}
.right-toc-title {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8b8b87;
  margin-bottom: var(--space-sm);
}
.right-toc a {
  display: block;
  color: #7a7a76;
  font-size: 13px;
  line-height: 1.5;
  padding: 6px 0 6px 10px;
  border-left: 2px solid transparent;
  margin-left: -13px;
  font-weight: 500;
}
.right-toc a:hover { color: var(--text); text-decoration: none; }
.right-toc a.active { color: var(--text); border-left-color: rgba(18, 18, 18, 0.25); }

/* Domain cards */
.domain-card { background: var(--panel); border-radius: 6px; padding: var(--space-lg); border: 1px solid var(--border); }
.domain-card-link {
  display: block;
  color: inherit;
  text-decoration: none;
  border-radius: 6px;
  transition: background 0.16s ease, border-color 0.16s ease;
}
.domain-card-link:hover { background: rgba(18, 18, 18, 0.03); text-decoration: none; }
.domain-card-icon {
  font-size: 20px;
  line-height: 1;
  margin-bottom: var(--space-sm);
  color: #4a4a47;
}
.domain-card h3 { margin: 0 0 var(--space-sm) 0; }
.domain-card p { margin: 0 0 var(--space-md) 0; color: #6f6f6b; font-size: 13px; opacity: 0.85; }

/* Method badges */
.method-badge { display: inline-block; padding: var(--space-xs) var(--space-sm); border-radius: 4px; font-size: 11px; font-weight: 600; font-family: 'JetBrains Mono', monospace; }
.method-get, .method-post, .method-put, .method-delete, .method-options { font-weight: 600; opacity: 0.6; }

/* Kind badges */
.kind-badge { display: inline-block; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; margin-left: var(--space-sm); opacity: 0.5; }
.kind-function, .kind-class, .kind-interface, .kind-type, .kind-variable, .kind-enum, .kind-component { }

/* Inline entity on domain pages */
.entity-block { margin: 0; padding-top: 0; border-top: none; }
.entity-block + .entity-block { margin-top: var(--space-2xl); padding-top: var(--space-2xl); border-top: 1px solid var(--border); }
.entity-block h3 { margin: 0 0 var(--space-sm) 0; font-size: 18px; }
.entity-block .entity-file-path { margin: 0 0 var(--space-md) 0; font-size: 12px; }
.entity-block .explanation { color: #3e3e3b; line-height: 1.65; margin: var(--space-sm) 0; }
.entity-block .explanation p { margin: 0 0 var(--space-sm) 0; max-width: 72ch; }
.entity-block .meta { font-size: 11px; color: #7a7a76; opacity: 0.8; }

.domain-pager {
  display: flex;
  width: 100%;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}
.domain-pager-card {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: var(--space-md);
  background: var(--panel);
}
.domain-pager-card:hover { background: var(--panel-2); text-decoration: none; }
.domain-pager-card.empty { visibility: hidden; pointer-events: none; }
.domain-pager-label {
  display: block;
  font-size: 12px;
  color: #8b8b87;
  margin-bottom: 4px;
}
.domain-pager-name {
  display: block;
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
}
.domain-pager-next { text-align: right; }

/* Tree */
.tree-wrap { position: relative; border-radius: 6px; background: #efefec; overflow: hidden; margin-top: var(--space-lg); border: 1px solid var(--border); }
.tree-container { width: 100%; min-height: 700px; display: block; }
.tree-tooltip { position: absolute; background: #232323; border-radius: 6px; padding: var(--space-sm) var(--space-md); color: #f7f7f5; font-size: 12px; pointer-events: none; z-index: 200; display: none; }
.graph-sidebar {
  position: absolute;
  top: 0;
  right: 0;
  width: 300px;
  height: 100%;
  background: rgba(255,255,255,0.97);
  padding: var(--space-md);
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 180ms ease-out;
  z-index: 150;
}
.graph-sidebar.open { transform: translateX(0%); }
.graph-sidebar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-sm); }
.graph-sidebar-close {
  background: transparent;
  border: 0;
  color: #232323;
  border-radius: 4px;
  width: 28px;
  height: 28px;
  cursor: pointer;
}
.graph-sidebar h3 { margin: 0 0 var(--space-xs) 0; }
.graph-sidebar h4 { margin: var(--space-md) 0 var(--space-sm); color: #64748b; font-size: 0.9rem; }
.graph-sidebar ul { margin: 0; padding-left: var(--space-md); }
.graph-sidebar li { margin-bottom: var(--space-sm); color: #3e3e3b; }
.foundation-tag { display: inline-block; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-sm); opacity: 0.5; }
.site-footer { padding: var(--space-3xl) var(--space-xl) var(--space-xl); margin-top: var(--space-2xl); }
.footer-content {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-sm);
  color: #4b5563;
  font-size: 11px;
  opacity: 0.6;
  text-align: center;
}
.footer-content strong { color: #5f5f5b; font-weight: 600; }
.footer-sep { color: #9a9a95; }

/* Breadcrumbs */
.breadcrumb { margin: 0; font-size: 12px; opacity: 0.9; }
.breadcrumb a { color: #5f5f5b; text-decoration: none; font-weight: 500; }
.breadcrumb a:hover { text-decoration: underline; }
.breadcrumb-sep { color: #9a9a95; margin: 0 var(--space-sm); }
.breadcrumb span:last-child { color: #6f6f6b; }

/* File section separators */
.domain-file-section + .domain-file-section { margin-top: var(--space-xl); padding-top: var(--space-sm); }

/* Graph legend */
.graph-legend { display: flex; gap: var(--space-lg); margin: var(--space-sm) 0 var(--space-md); flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: var(--space-sm); font-size: 11px; color: #7a7a76; opacity: 0.85; }
.legend-line { display: inline-block; width: 24px; height: 2px; border-radius: 1px; }
.legend-tree { background: #475569; }
.legend-dep-out { border-top: 2px dashed #64748b; }
.legend-dep-in { border-top: 2px dashed #64748b; }
.legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 4px; }

/* Cmd+K search modal */
.search-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999; display: flex; align-items: flex-start; justify-content: center; padding-top: 20vh; }
.search-modal { background: var(--panel); border-radius: 6px; width: 520px; max-width: 90vw; overflow: hidden; border: 1px solid var(--border); }
.search-input { width: 100%; padding: var(--space-md) var(--space-lg); background: transparent; border: none; color: var(--text); font-size: 16px; font-family: inherit; outline: none; }
.search-input::placeholder { color: #8b8b87; }
.search-results { max-height: 320px; overflow-y: auto; }
.search-result-item { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm) var(--space-lg); color: var(--text); text-decoration: none; transition: background 0.1s; font-size: 13px; }
.search-result-item:hover { background: rgba(18, 18, 18, 0.06); }
.search-type-badge { display: inline-block; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; min-width: 52px; opacity: 0.5; }
.search-type-entity, .search-type-file, .search-type-domain { }

/* Inline table/page search */
.inline-search-input {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border-radius: 4px;
  border: 1px solid var(--border-strong);
  background: var(--panel);
  color: var(--text);
  margin-bottom: var(--space-md);
}

/* Back to top */
.back-to-top { position: fixed; bottom: 24px; right: 24px; width: 40px; height: 40px; border-radius: 4px; background: var(--panel); border: 1px solid var(--border); color: #6f6f6b; font-size: 18px; cursor: pointer; display: none; align-items: center; justify-content: center; z-index: 500; transition: background 0.15s, color 0.15s; }
.back-to-top:hover { background: var(--panel-2); color: var(--text); }

/* Dark theme */
html.dark {
  --bg: #121212;
  --panel: #1a1a1a;
  --panel-2: #2a2a2a;
  --text: #e8e8e6;
  --muted: #adada8;
  --link: var(--text);
  --accent: #8f8f8a;
  --border: rgba(255, 255, 255, 0.09);
  --border-strong: rgba(255, 255, 255, 0.14);
}
html.dark .sidebar { background: #1a1a1a; }
html.dark .sidebar-brand-link { color: var(--text); }
html.dark .sidebar-toggle { color: #a5a5a0; }
html.dark .sidebar-toggle:hover { color: var(--text); background: rgba(255,255,255,0.06); }
html.dark .sidebar-link { color: #b8b8b2; }
html.dark .sidebar-link:hover { color: #f0f0ee; background: rgba(255,255,255,0.05); }
html.dark .sidebar-link.active { color: #f0f0ee; background: rgba(255,255,255,0.08); }
html.dark .sidebar-section-toggle { color: #9b9b96; }
html.dark .sidebar-section-toggle:hover { color: #d1d1cc; }
html.dark .domain-card-icon { color: #d2d2cd; }
html.dark .entity-block .explanation { color: #d2d2ce; }
html.dark .graph-sidebar { background: rgba(26,26,26,0.97); }
html.dark .graph-sidebar-close { color: #efefec; }
html.dark .footer-content { color: #9b9b96; }
html.dark .footer-content strong { color: #cfcfca; }
html.dark .legend-item { color: #a9a9a4; }
html.dark .topbar-theme-toggle { color: #b8b8b2; }
html.dark .topbar-theme-toggle:hover { color: #f0f0ee; background: rgba(255,255,255,0.08); }
html.dark .right-toc a.active { border-left-color: rgba(255, 255, 255, 0.4); }

/* Mobile responsive */

/* Hamburger button — hidden on desktop */
.mobile-menu-btn {
  display: none;
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 600;
  background: var(--panel);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  width: 36px;
  height: 36px;
  font-size: 18px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
}
.sidebar-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 500;
}
body.sidebar-overlay-open .sidebar-backdrop { display: block; }
body.sidebar-overlay-open .sidebar {
  transform: translateX(0) !important;
  box-shadow: 4px 0 24px rgba(0,0,0,0.5);
}

/* Tablet (max-width: 1024px) — icon strip */
@media (max-width: 1024px) {
  body { padding-left: 60px; }
  .top-bar { padding: 0 var(--space-md) 0 calc(var(--space-xl) + 8px); }
  .sidebar { width: 60px; }
  .sidebar .sidebar-link-text,
  .sidebar .sidebar-brand-link,
  .sidebar .sidebar-heading-full { opacity: 0; max-width: 0; overflow: hidden; pointer-events: none; }
  .sidebar .sidebar-section-toggle .sidebar-chevron { display: none; }
  .sidebar .sidebar-heading-abbr { display: block; }
  .sidebar .sidebar-link { justify-content: center; padding-left: 0; }
  .sidebar .sidebar-indent { padding-left: 0; }
  .sidebar .sidebar-toggle { display: none; }
  .content-layout { padding: var(--space-md); }
  .content, .content-wide { max-width: 100%; }
  .right-toc { display: none; }
  .site-footer { padding: var(--space-xl) var(--space-md) var(--space-md); }
  body.sidebar-collapsed { padding-left: 60px; }
}

@media (max-width: 1200px) {
  .right-toc { display: none; }
}

/* Small phone (max-width: 480px) — full overlay mode */
@media (max-width: 480px) {
  /* Body base */
  body { font-size: 13px; overflow-x: hidden; padding-left: 0; }

  /* Hamburger visible */
  .mobile-menu-btn { display: flex; }

  /* Sidebar off-screen, slides in as overlay */
  .sidebar {
    width: 220px;
    transform: translateX(-100%);
    transition: transform 220ms ease;
    position: fixed;
    z-index: 550;
  }
  /* Restore text in overlay mode */
  .sidebar .sidebar-link-text,
  .sidebar .sidebar-brand-link,
  .sidebar .sidebar-heading-full { opacity: 1; max-width: 160px; overflow: hidden; pointer-events: auto; }
  .sidebar .sidebar-heading-abbr { display: none; }
  .sidebar .sidebar-section-toggle .sidebar-chevron { display: inline-block; }
  .sidebar .sidebar-link { justify-content: flex-start; padding-left: var(--space-sm); }
  .sidebar .sidebar-indent { padding-left: var(--space-xl); }
  .sidebar .sidebar-toggle { display: none; }

  .top-bar { padding: 0 16px 0 56px; }
  .content-layout { padding: 16px; }
  .content, .content-wide { margin: 0 auto !important; max-width: 100%; box-sizing: border-box; }
  .site-footer {
    margin: 0 !important;
    padding: var(--space-md) 16px;
  }

  /* Domain card grid — single column */
  .grid { grid-template-columns: 1fr; }

  /* Search modal — full width */
  .search-modal { width: 100vw; max-width: 100vw; border-radius: 0; margin: 0; }
  .search-modal-overlay { align-items: flex-start; }

  /* Tables — horizontal scroll */
  table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%; }

  /* Code blocks */
  pre { font-size: 11px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  code { font-size: 11px; }

  /* Breadcrumbs */
  .breadcrumb { font-size: 11px; white-space: normal; word-break: break-word; }

  /* Entity blocks */
  .entity-block { padding: var(--space-sm); max-width: 100%; }

  /* Graph legend */
  .graph-legend { gap: var(--space-sm); flex-wrap: wrap; }

  /* Graph sidebar — stack below on phone */
  .graph-sidebar {
    position: static;
    width: 100%;
    height: auto;
    transform: none !important;
    border-top: 1px solid var(--border);
    margin-top: var(--space-md);
  }

  .domain-pager { flex-direction: column; }
  .domain-pager-card.empty { display: none; }
}
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
  document.querySelectorAll('[data-domain-header]').forEach((header) => {
    const domain = header.getAttribute('data-domain-header');
    if (!domain) return;
    const visibleRows = Array.from(document.querySelectorAll('[data-domain="' + domain + '"]')).some((row) => row.style.display !== 'none');
    header.style.display = visibleRows ? '' : 'none';
  });
}
document.getElementById('search')?.addEventListener('input', filterRows);

(function() {
  var overlay = document.createElement('div');
  overlay.className = 'search-modal-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML = '<div class="search-modal"><input class="search-input" type="search" placeholder="Search entities, files, domains..." /><div class="search-results"></div></div>';
  document.body.appendChild(overlay);

  var input = overlay.querySelector('.search-input');
  var results = overlay.querySelector('.search-results');
  var activeIndex = -1;
  var activeItems = [];

  function closeModal() {
    overlay.style.display = 'none';
    input.value = '';
    results.innerHTML = '';
    activeItems = [];
    activeIndex = -1;
  }

  function openModal() {
    overlay.style.display = 'flex';
    setTimeout(function() { input.focus(); }, 0);
    renderResults('');
  }

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderResults(query) {
    var items = (window.SEARCH_INDEX || []).filter(function(item) {
      var q = query.toLowerCase();
      return !q || (item.name || '').toLowerCase().includes(q) || (item.path || '').toLowerCase().includes(q) || (item.kind || '').toLowerCase().includes(q);
    }).slice(0, 20);

    if (!items.length) {
      results.innerHTML = '<div class="search-empty">No results</div>';
      activeItems = [];
      activeIndex = -1;
      return;
    }

    var prefix = document.body.getAttribute('data-asset-prefix') || '';
    var fragment = document.createDocumentFragment();
    items.forEach(function(item, i) {
      var a = document.createElement('a');
      a.className = 'search-result' + (i === 0 ? ' active' : '');
      a.dataset.index = String(i);
      a.href = prefix + escHtml(item.path);
      var typeSpan = document.createElement('span');
      typeSpan.className = 'search-type';
      typeSpan.textContent = item.type;
      a.appendChild(typeSpan);
      a.appendChild(document.createTextNode(item.name));
      fragment.appendChild(a);
    });
    results.innerHTML = '';
    results.appendChild(fragment);

    activeItems = Array.from(results.querySelectorAll('.search-result'));
    activeIndex = 0;
  }

  input.addEventListener('input', function() {
    renderResults(input.value || '');
  });

  input.addEventListener('keydown', function(e) {
    if (!activeItems.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, activeItems.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var target = activeItems[activeIndex];
      if (target) window.location.href = target.getAttribute('href');
      return;
    } else if (e.key === 'Escape') {
      closeModal();
      return;
    } else {
      return;
    }
    activeItems.forEach(function(el, i) { el.classList.toggle('active', i === activeIndex); });
    activeItems[activeIndex]?.scrollIntoView({ block: 'nearest' });
  });

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener('keydown', function(e) {
    var isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
    if (isCmdK) {
      e.preventDefault();
      if (overlay.style.display === 'flex') closeModal(); else openModal();
      return;
    }
    if (e.key === 'Escape' && overlay.style.display === 'flex') {
      closeModal();
    }
  });
})();

(function() {
  var btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.innerHTML = '↑';
  btn.title = 'Back to top';
  document.body.appendChild(btn);
  btn.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  window.addEventListener('scroll', function() {
    btn.style.display = window.scrollY > 400 ? 'flex' : 'none';
  });
})();

// Theme toggle (dark/light)
(function() {
  var theme = localStorage.getItem('explain-theme') || 'light';
  if (theme === 'dark') document.documentElement.classList.add('dark');

  document.addEventListener('click', function(e) {
    var button = e.target instanceof Element ? e.target.closest('[data-theme-toggle]') : null;
    if (!button) return;
    var isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('explain-theme', isDark ? 'dark' : 'light');
    if (window.syncHighlightTheme) window.syncHighlightTheme();
  });

  if (window.syncHighlightTheme) window.syncHighlightTheme();
})();
`;
}

function inferApiPath(filePath: string): string | null {
  if (!filePath.startsWith("src/pages/")) return null;
  let route = filePath.slice("src/pages/".length);
  route = route.replace(/(\.(ts|tsx|js|jsx))$/, "");
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

  const palette = ["#64748b", "#64748b", "#64748b", "#64748b", "#64748b", "#64748b", "#64748b", "#64748b"];
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
        return `<tr data-search="${escapeHtml(`${entity.name} ${entity.kind}`)}"><td><a href="${href}">${escapeHtml(entity.name)}</a></td><td><span class="kind-badge kind-${entity.kind}">${escapeHtml(entity.kind)}</span></td><td>${entity.exported ? "yes" : "no"}</td></tr>`;
      })
      .join("\n");

    const html = `${baseHead(`File: ${file.path}`, projectName, "../", input.domains, { breadcrumb: file.path })}
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
    const html = `${baseHead(`Entity: ${entity.name}`, projectName, "../", input.domains, { breadcrumb: entity.name })}
<section class="card">
  <h1>${escapeHtml(entity.name)} <span class="kind-badge kind-${entity.kind}">${escapeHtml(entity.kind)}</span></h1>
  <p class="muted">${escapeHtml(entity.filePath)}:${entity.loc.startLine}-${entity.loc.endLine}</p>
  <p><a href="${fileHref}">Open file page</a> • <a href="${escapeHtml(entity.sourceUrl)}" target="_blank" rel="noreferrer">Source</a></p>
  ${entity.signature ? `<pre><code>${escapeHtml(entity.signature)}</code></pre>` : ""}
  <h2>Explanation</h2>
  ${entity.explanation.status !== "ok" && entity.explanation.status !== "cached" ? `<p class="status-${entity.explanation.status}">${escapeHtml(entity.explanation.status)}</p>` : ""}
  <pre><code>${escapeHtml(entity.explanation.text)}</code></pre>
  ${entity.explanation.errorMessage ? `<p class="status-failed">${escapeHtml(entity.explanation.errorMessage)}</p>` : ""}
</section>
${baseFoot()}`;

    fs.writeFileSync(path.join(entitiesDir, entityPageMap.get(entity.id) ?? "unknown.html"), html, "utf8");
  }

  for (const domain of input.domains) {
    const tocItems: Array<{ id: string; name: string }> = [];
    const fileBlocks = domain.files
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .map((filePath) => {
        const file = input.files.find((f) => f.path === filePath);
        const fileHref = `../files/${filePageMap.get(filePath)}`;
        const entities = input.entities.filter((e) => e.filePath === filePath);
        if (entities.length === 0) {
          return `<section class="card domain-file-section"><h2><a href="${fileHref}">${escapeHtml(filePath)}</a></h2><p class="muted">Configuration/type definition file</p></section>`;
        }

        const entityHtml = entities
          .map((entity) => {
            const entityHref = `../entities/${entityPageMap.get(entity.id)}`;
            const anchorId = `${domain.slug}-${slugify(entity.name) || "entity"}-${entity.id.slice(0, 6)}`;
            tocItems.push({ id: anchorId, name: entity.name });
            const explanationHtml = entity.explanation.text
              .split(/\n\n+/)
              .map(p => `<p>${escapeHtml(p.trim())}</p>`)
              .join("\n");
            return `<div id="${escapeHtml(anchorId)}" class="entity-block"><h3>${escapeHtml(entity.name)} <span class="kind-badge kind-${entity.kind}">${escapeHtml(entity.kind)}</span></h3><p class="entity-file-path muted">${escapeHtml(entity.filePath)}:${entity.loc.startLine}-${entity.loc.endLine}</p><div class="explanation">${explanationHtml}</div><p class="meta"><a href="${entityHref}">View source</a></p></div>`;
          })
          .join("\n");

        return `<section class="card domain-file-section"><h2><a href="${fileHref}">${escapeHtml(file?.path ?? filePath)}</a></h2>${entityHtml}</section>`;
      })
      .join("\n");

    const domainIndex = input.domains.findIndex((d) => d.slug === domain.slug);
    const prevDomain = domainIndex > 0 ? input.domains[domainIndex - 1] : null;
    const nextDomain = domainIndex >= 0 && domainIndex < input.domains.length - 1 ? input.domains[domainIndex + 1] : null;
    const pagerHtml = `<nav class="domain-pager">
  ${
    prevDomain
      ? `<a class="domain-pager-card domain-pager-prev" href="${escapeHtml(`../domains/${prevDomain.slug}.html`)}"><span class="domain-pager-label">← Previous</span><span class="domain-pager-name">${escapeHtml(cleanDomainName(prevDomain))}</span></a>`
      : `<div class="domain-pager-card empty" aria-hidden="true"></div>`
  }
  ${
    nextDomain
      ? `<a class="domain-pager-card domain-pager-next" href="${escapeHtml(`../domains/${nextDomain.slug}.html`)}"><span class="domain-pager-label">Next →</span><span class="domain-pager-name">${escapeHtml(cleanDomainName(nextDomain))}</span></a>`
      : `<div class="domain-pager-card empty" aria-hidden="true"></div>`
  }
</nav>`;

    const tocHtml = tocItems.length
      ? `<div class="right-toc-title">On this page</div>${tocItems.map((item) => `<a href="#${escapeHtml(item.id)}">${escapeHtml(item.name)}</a>`).join("")}`
      : "";

    const domainHtml = `${baseHead(cleanDomainName(domain), projectName, "../", input.domains, { breadcrumb: cleanDomainName(domain) })}
<section class="card">
  <h1>${escapeHtml(cleanDomainName(domain))}</h1>
  <p class="muted">${escapeHtml(cleanDomainDescription(domain))}</p>
</section>
${fileBlocks}
${pagerHtml}
${baseFoot(tocHtml || undefined)}`;

    fs.writeFileSync(path.join(domainsDir, `${domain.slug}.html`), domainHtml, "utf8");
  }

  const domainCards = input.domains
    .map((domain) => {
      const fileCount = domain.files.length;
      const entityCount = input.entities.filter((e) => domain.files.includes(e.filePath)).length;
      return `<a class="domain-card-link" href="domains/${escapeHtml(domain.slug)}.html" data-search="${escapeHtml(`${cleanDomainName(domain)} ${cleanDomainDescription(domain)}`)}"><div class="domain-card"><div class="domain-card-icon">${escapeHtml(domainCardIcon(domain))}</div>${domain.kind === "foundation" ? `<span class="foundation-tag">Infrastructure</span>` : ""}<h3>${escapeHtml(cleanDomainName(domain))}</h3><p>${escapeHtml(cleanDomainDescription(domain))}</p><p class="muted">${fileCount} files, ${entityCount} entities</p></div></a>`;
    })
    .join("\n");

  const entityRows = input.domains
    .slice()
    .sort((a, b) => cleanDomainName(a).localeCompare(cleanDomainName(b)))
    .map((domain) => {
      const domainEntities = input.entities
        .filter((entity) => resolveFile(entity.filePath, fileToDomain)?.slug === domain.slug)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (domainEntities.length === 0) return "";
      const headerRow = `<tr class="table-section-row" data-domain-header="${escapeHtml(domain.slug)}"><td colspan="4">${escapeHtml(cleanDomainName(domain))}</td></tr>`;
      const rows = domainEntities
        .map((entity) => {
          const href = `entities/${entityPageMap.get(entity.id)}`;
          return `<tr data-domain="${escapeHtml(domain.slug)}" data-search="${escapeHtml(`${entity.filePath} ${entity.name} ${entity.kind} ${cleanDomainName(domain)}`)}"><td><a href="${href}">${escapeHtml(entity.name)}</a></td><td><span class="kind-badge kind-${entity.kind}">${escapeHtml(entity.kind)}</span></td><td>${escapeHtml(entity.filePath)}</td><td class="status-${entity.explanation.status}">${escapeHtml(entity.explanation.status)}</td></tr>`;
        })
        .join("\n");
      return `${headerRow}\n${rows}`;
    })
    .join("\n");

  const apiRows = input.files
    .flatMap((file) => {
      const pathValue = inferApiPath(file.path);
      if (!pathValue) return [];
      const routes = input.routes.filter((r) => r.filePath === file.path);
      const desc = input.entities.find((e) => e.filePath === file.path)?.explanation.text ?? "Route handler";
      if (routes.length === 0) {
        const method = "GET";
        return [{ method, className: `method-${method.toLowerCase()}`, path: pathValue, file: file.path, desc }];
      }
      return routes.map((route) => {
        const method = (route.method ?? "GET").toUpperCase();
        return { method, className: `method-${method.toLowerCase()}`, path: pathValue, file: file.path, desc };
      });
    })
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(
      (row) => `<tr><td><span class="method-badge ${row.className}">${escapeHtml(row.method)}</span></td><td>${escapeHtml(row.path)}</td><td class="api-description">${escapeHtml(row.desc)}</td><td>${escapeHtml(row.file)}</td></tr>`,
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
      name: cleanDomainName(domain),
      slug: domain.slug,
      kind: domain.kind,
      domainName: cleanDomainName(domain),
      children: domain.files
        .filter((filePath, index, arr) => arr.indexOf(filePath) === index)
        .map((filePath) => ({
          name: path.basename(filePath).replace(path.extname(filePath), "") || filePath,
          file: filePath,
          href: `files/${filePageMap.get(filePath)}`,
        })),
    })),
    foundationDomains: foundationDomains.map((domain) => ({
      name: cleanDomainName(domain),
      slug: domain.slug,
      kind: domain.kind,
      domainName: cleanDomainName(domain),
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

  const searchIndex = [
    ...input.entities.map((e) => ({ type: "entity", name: e.name, kind: e.kind, path: `entities/${entityPageMap.get(e.id)}` })),
    ...input.files.map((f) => ({ type: "file", name: f.path, path: `files/${filePageMap.get(f.path)}` })),
    ...input.domains.map((d) => ({ type: "domain", name: cleanDomainName(d), path: `domains/${d.slug}.html` })),
  ];
  fs.writeFileSync(path.join(input.outDir, "search-index.js"), `window.SEARCH_INDEX = ${JSON.stringify(searchIndex)};\n`, "utf8");

  const indexHtml = `${baseHead("Overview", projectName, "", input.domains)}
<h1>${escapeHtml(projectName)}</h1>
${input.projectSummary ? `<p class="muted">${escapeHtml(input.projectSummary)}</p>` : ""}
<section class="card">
  <h2>Domains</h2>
  <input id="search" class="inline-search-input" type="search" placeholder="Search domains" />
  <div class="grid">${domainCards}</div>
</section>
${baseFoot()}`;

  const referenceHtml = `${baseHead("Developer Reference", projectName, "", input.domains, { contentClass: "content-wide", breadcrumb: "Developer Reference" })}
<section class="card">
  <h1>Developer Reference</h1>
  <input id="search" class="inline-search-input" type="search" placeholder="Search entities" />
  <table class="table table-reference">
    <thead><tr><th>Name</th><th>Kind</th><th>File</th><th>Status</th></tr></thead>
    <tbody>${entityRows}</tbody>
  </table>
</section>
${baseFoot()}`;

  const apiHtml = `${baseHead("API Reference", projectName, "", input.domains, { contentClass: "content-wide", breadcrumb: "API Reference" })}
<section class="card">
  <h1>API Reference</h1>
  <table class="table table-api">
    <thead><tr><th>Method</th><th>Path</th><th>Description</th><th>File</th></tr></thead>
    <tbody>${apiRows || '<tr><td colspan="4">No API routes inferred</td></tr>'}</tbody>
  </table>
</section>
${baseFoot()}`;

  const graphHtml = `${baseHead("Architecture Map", projectName, "", input.domains, { contentClass: "content-wide" })}
<section class="card">
  <h1>Architecture Map</h1>
  <p class="muted">Project, domains, and key capabilities by file.</p>
  <div class="graph-legend">
    <div class="legend-item"><span class="legend-line legend-tree"></span> Hierarchy</div>
    <div class="legend-item"><span class="legend-line legend-dep-out"></span> Depends on</div>
    <div class="legend-item"><span class="legend-line legend-dep-in"></span> Depended on by</div>
    <div class="legend-item"><span class="legend-dot" style="background:#334155"></span> Foundation</div>
  </div>
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
  .attr('fill', '#64748b');

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
  .attr('fill', '#64748b');

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

  sidebarTitle.textContent = domainNode?.domainName || slug;
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
    .attr('stroke', '#64748b')
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
      .attr('stroke', '#64748b')
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
        .attr('stroke', '#64748b')
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

  const now = new Date().toISOString();

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
