import path from "node:path";
import {
  ArrowFunction,
  ClassDeclaration,
  EnumDeclaration,
  FunctionDeclaration,
  InterfaceDeclaration,
  MethodDeclaration,
  Node,
  Project,
  PropertyDeclaration,
  SourceFile,
  SyntaxKind,
  TypeAliasDeclaration,
  VariableDeclaration,
} from "ts-morph";
import ts from "typescript";
import { Entity, EntityKind, FileInfo, RouteInfo } from "./types";
import { sha256 } from "./utils";

export interface ParsedFileResult {
  filePath: string;
  entities: Omit<Entity, "explanation" | "sourceUrl">[];
  routes: RouteInfo[];
  imports: string[];
  exports: string[];
}

function getLoc(node: Node): { startLine: number; endLine: number } {
  const source = node.getSourceFile();
  const start = source.getLineAndColumnAtPos(node.getStart());
  const end = source.getLineAndColumnAtPos(node.getEnd());
  return {
    startLine: start.line,
    endLine: end.line,
  };
}

function isLikelyComponent(name: string): boolean {
  return /^[A-Z]/.test(name);
}

function symbolKindFromNode(node: Node, name: string): EntityKind {
  if (Node.isFunctionDeclaration(node) || Node.isArrowFunction(node)) {
    return isLikelyComponent(name) ? "component" : "function";
  }
  if (Node.isClassDeclaration(node)) {
    return "class";
  }
  if (Node.isMethodDeclaration(node)) {
    return "method";
  }
  if (Node.isInterfaceDeclaration(node)) {
    return "interface";
  }
  if (Node.isTypeAliasDeclaration(node)) {
    return "type";
  }
  if (Node.isEnumDeclaration(node)) {
    return "enum";
  }
  return "const";
}

function sanitizeTypeText(typeText: string, repoPath: string): string {
  const normalizedRepo = repoPath.split(path.sep).join("/");
  return typeText.replace(/([A-Za-z]:)?\/[A-Za-z0-9._\-/]+/g, (matched) => {
    const normalized = matched.replace(/\\/g, "/");
    if (normalized.startsWith(normalizedRepo)) {
      const rel = normalized.slice(normalizedRepo.length).replace(/^\/+/, "");
      return rel ? rel : ".";
    }
    return matched;
  });
}

function functionSignature(fn: FunctionDeclaration | ArrowFunction | MethodDeclaration, repoPath: string): string {
  const params = fn
    .getParameters()
    .map((p) => `${p.getName()}: ${sanitizeTypeText(p.getType().getText(), repoPath)}`)
    .join(", ");
  const ret = sanitizeTypeText(fn.getReturnType().getText(), repoPath);
  return `(${params}) => ${ret}`;
}

function buildEntity(
  filePath: string,
  node: Node,
  name: string,
  exported: boolean,
  repoPath: string,
): Omit<Entity, "explanation" | "sourceUrl"> {
  const loc = getLoc(node);
  let signature: string | undefined;

  if (Node.isFunctionDeclaration(node) || Node.isArrowFunction(node) || Node.isMethodDeclaration(node)) {
    signature = functionSignature(node, repoPath);
  }

  if (Node.isClassDeclaration(node)) {
    const className = node.getName() ?? name;
    signature = `class ${className}`;
  }

  const kind = symbolKindFromNode(node, name);
  const stableInput = `${filePath}:${name}:${kind}:${loc.startLine}:${loc.endLine}:${node.getText()}`;
  const id = sha256(stableInput);

  return {
    id,
    filePath,
    name,
    kind,
    exported,
    loc,
    signature,
    contentHash: sha256(node.getText()),
    snippet: node.getText(),
  };
}

function extractFunctionDeclarations(
  filePath: string,
  sourceFile: SourceFile,
  repoPath: string,
): Omit<Entity, "explanation" | "sourceUrl">[] {
  const entities: Omit<Entity, "explanation" | "sourceUrl">[] = [];

  sourceFile.getFunctions().forEach((fn: FunctionDeclaration) => {
    const name = fn.getName();
    if (!name) return;
    entities.push(buildEntity(filePath, fn, name, fn.isExported(), repoPath));
  });

  sourceFile.getClasses().forEach((klass: ClassDeclaration) => {
    const className = klass.getName() ?? "AnonymousClass";
    entities.push(buildEntity(filePath, klass, className, klass.isExported(), repoPath));

    klass.getMethods().forEach((method: MethodDeclaration) => {
      const methodName = `${className}.${method.getName()}`;
      entities.push(buildEntity(filePath, method, methodName, klass.isExported(), repoPath));
    });

    klass.getProperties().forEach((prop: PropertyDeclaration) => {
      if (prop.hasInitializer() && prop.getInitializerIfKind(SyntaxKind.ArrowFunction)) {
        const fn = prop.getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
        entities.push(buildEntity(filePath, fn, `${className}.${prop.getName()}`, klass.isExported(), repoPath));
      }
    });
  });

  sourceFile.getInterfaces().forEach((iface: InterfaceDeclaration) => {
    entities.push(buildEntity(filePath, iface, iface.getName(), iface.isExported(), repoPath));
  });

  sourceFile.getTypeAliases().forEach((alias: TypeAliasDeclaration) => {
    entities.push(buildEntity(filePath, alias, alias.getName(), alias.isExported(), repoPath));
  });

  sourceFile.getEnums().forEach((enm: EnumDeclaration) => {
    entities.push(buildEntity(filePath, enm, enm.getName(), enm.isExported(), repoPath));
  });

  sourceFile.getVariableDeclarations().forEach((decl: VariableDeclaration) => {
    const name = decl.getName();
    const initializer = decl.getInitializer();
    const isExported = decl.getVariableStatement()?.isExported() ?? false;

    if (!initializer) {
      return;
    }

    if (Node.isArrowFunction(initializer)) {
      entities.push(buildEntity(filePath, initializer, name, isExported, repoPath));
      return;
    }

    entities.push(buildEntity(filePath, decl, name, isExported, repoPath));
  });

  return entities;
}

function extractRoutes(filePath: string, sourceFile: SourceFile): RouteInfo[] {
  const routes: RouteInfo[] = [];

  const astroMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "ALL"];
  for (const decl of sourceFile.getVariableDeclarations()) {
    const name = decl.getName();
    if (!astroMethods.includes(name)) continue;
    const stmt = decl.getVariableStatement();
    if (!stmt?.isExported()) continue;
    const loc = getLoc(decl);
    routes.push({
      id: sha256(`${filePath}:astro:${name}:${loc.startLine}`),
      filePath,
      frameworkHint: "astro",
      method: name,
      loc,
      confidence: "high",
    });
  }

  const methods = new Set(["get", "post", "put", "patch", "delete", "all"]);
  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;

    const expr = node.getExpression();
    if (!Node.isPropertyAccessExpression(expr)) return;

    const methodName = expr.getName().toLowerCase();
    if (!methods.has(methodName)) return;

    const receiver = expr.getExpression();
    if (!Node.isIdentifier(receiver)) return;
    const receiverName = receiver.getText();
    if (receiverName !== "app" && receiverName !== "router") return;

    const args = node.getArguments();
    const firstArg = args[0];
    if (!firstArg || !Node.isStringLiteral(firstArg)) return;

    const routePath = firstArg.getLiteralValue();
    if (!routePath.startsWith("/")) return;

    const loc = getLoc(node);
    routes.push({
      id: sha256(`${filePath}:${receiverName}:${methodName}:${routePath}:${loc.startLine}`),
      filePath,
      frameworkHint: "express",
      method: methodName.toUpperCase(),
      path: routePath,
      loc,
      confidence: "high",
    });
  });

  return routes;
}

function resolveImportSpecifierPath(filePath: string, importPath: string): string {
  if (!importPath.startsWith(".")) {
    return importPath;
  }
  return path.posix.normalize(path.posix.join(path.posix.dirname(filePath), importPath));
}

export function parseFiles(files: FileInfo[], repoPath: string): ParsedFileResult[] {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      jsx: ts.JsxEmit.React,
    },
  });

  for (const file of files) {
    project.createSourceFile(file.absolutePath, file.content, { overwrite: true });
  }

  const sourceFiles = project.getSourceFiles();
  return sourceFiles.map((sourceFile) => {
    const relPath = path.posix.normalize(path.relative(repoPath, sourceFile.getFilePath()).split(path.sep).join("/"));

    const imports = sourceFile.getImportDeclarations().map((i) => resolveImportSpecifierPath(relPath, i.getModuleSpecifierValue()));

    const exports = sourceFile
      .getExportSymbols()
      .map((symbol) => symbol.getName())
      .filter((name) => name !== "default");

    return {
      filePath: relPath,
      entities: extractFunctionDeclarations(relPath, sourceFile, repoPath),
      routes: extractRoutes(relPath, sourceFile),
      imports,
      exports,
    };
  });
}
