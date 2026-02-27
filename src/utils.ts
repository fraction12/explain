import crypto from "node:crypto";
import path from "node:path";

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function normalizeSlashes(value: string): string {
  return value.split(path.sep).join("/");
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function timestamp(): string {
  return new Date().toISOString();
}

export function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
