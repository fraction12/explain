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

function functionSignature(fn: FunctionDeclaration | ArrowFunction | MethodDeclaration): string {
  const params = fn
    .getParameters()
    .map((p) => `${p.getName()}: ${p.getType().getText()}`)
    .join(", ");
  const ret = fn.getReturnType().getText();
  return `(${params}) => ${ret}`;
}

function buildEntity(filePath: string, node: Node, name: string, exported: boolean): Omit<Entity, "explanation" | "sourceUrl"> {
  const loc = getLoc(node);
  let signature: string | undefined;

  if (Node.isFunctionDeclaration(node) || Node.isArrowFunction(node) || Node.isMethodDeclaration(node)) {
    signature = functionSignature(node);
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

function extractFunctionDeclarations(filePath: string, sourceFile: SourceFile): Omit<Entity, "explanation" | "sourceUrl">[] {
  const entities: Omit<Entity, "explanation" | "sourceUrl">[] = [];

  sourceFile.getFunctions().forEach((fn: FunctionDeclaration) => {
    const name = fn.getName();
    if (!name) return;
    entities.push(buildEntity(filePath, fn, name, fn.isExported()));
  });

  sourceFile.getClasses().forEach((klass: ClassDeclaration) => {
    const className = klass.getName() ?? "AnonymousClass";
    entities.push(buildEntity(filePath, klass, className, klass.isExported()));

    klass.getMethods().forEach((method: MethodDeclaration) => {
      const methodName = `${className}.${method.getName()}`;
      entities.push(buildEntity(filePath, method, methodName, method.isExported()));
    });

    klass.getProperties().forEach((prop: PropertyDeclaration) => {
      if (prop.hasInitializer() && prop.getInitializerIfKind(SyntaxKind.ArrowFunction)) {
        const fn = prop.getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
        entities.push(buildEntity(filePath, fn, `${className}.${prop.getName()}`, prop.isExported()));
      }
    });
  });

  sourceFile.getInterfaces().forEach((iface: InterfaceDeclaration) => {
    entities.push(buildEntity(filePath, iface, iface.getName(), iface.isExported()));
  });

  sourceFile.getTypeAliases().forEach((alias: TypeAliasDeclaration) => {
    entities.push(buildEntity(filePath, alias, alias.getName(), alias.isExported()));
  });

  sourceFile.getEnums().forEach((enm: EnumDeclaration) => {
    entities.push(buildEntity(filePath, enm, enm.getName(), enm.isExported()));
  });

  sourceFile.getVariableDeclarations().forEach((decl: VariableDeclaration) => {
    const name = decl.getName();
    const initializer = decl.getInitializer();
    const isExported = decl.getVariableStatement()?.isExported() ?? false;

    if (!initializer) {
      return;
    }

    if (Node.isArrowFunction(initializer)) {
      entities.push(buildEntity(filePath, initializer, name, isExported));
      return;
    }

    entities.push(buildEntity(filePath, decl, name, isExported));
  });

  return entities;
}

function extractRoutes(filePath: string, sourceFile: SourceFile): RouteInfo[] {
  const routes: RouteInfo[] = [];

  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) {
      return;
    }

    const exprText = node.getExpression().getText();
    const args = node.getArguments();
    const loc = getLoc(node);

    const methods = ["get", "post", "put", "patch", "delete", "all"];
    for (const method of methods) {
      if (exprText.endsWith(`.${method}`) && args.length > 0) {
        const firstArg = args[0];
        if (Node.isStringLiteral(firstArg)) {
          routes.push({
            id: sha256(`${filePath}:${exprText}:${firstArg.getLiteralValue()}:${loc.startLine}`),
            filePath,
            frameworkHint: exprText.startsWith("app.") || exprText.startsWith("router.") ? "express" : "unknown",
            method: method.toUpperCase(),
            path: firstArg.getLiteralValue(),
            loc,
            confidence: "medium",
          });
          return;
        }
      }
    }

    if (exprText.endsWith("route") && args.length > 0 && Node.isStringLiteral(args[0])) {
      routes.push({
        id: sha256(`${filePath}:${exprText}:${args[0].getLiteralValue()}:${loc.startLine}`),
        filePath,
        frameworkHint: "fastify",
        path: args[0].getLiteralValue(),
        loc,
        confidence: "low",
      });
      return;
    }

    if (exprText === "NextResponse.json" || exprText === "NextResponse.redirect") {
      routes.push({
        id: sha256(`${filePath}:${exprText}:${loc.startLine}`),
        filePath,
        frameworkHint: "next",
        loc,
        confidence: "low",
      });
    }
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
      entities: extractFunctionDeclarations(relPath, sourceFile),
      routes: extractRoutes(relPath, sourceFile),
      imports,
      exports,
    };
  });
}
