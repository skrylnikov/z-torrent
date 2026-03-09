#!/usr/bin/env tsx
/**
 * Count transitive dependencies for each workspace package.
 * Parses bun.lock and recursively resolves the dependency tree.
 */

import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");
const LOCKFILE = join(ROOT, "bun.lock");

// Bun lockfile has trailing commas - parse by removing them
function parseLockfile(content: string): unknown {
  const fixed = content.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(fixed) as {
    workspaces: Record<
      string,
      {
        name?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        optionalDependencies?: Record<string, string>;
      }
    >;
    packages: Record<
      string,
      [string, string, { dependencies?: Record<string, string> }]
    >;
  };
}

type Lockfile = ReturnType<typeof parseLockfile>;

function getPackageName(spec: string): string {
  if (spec.startsWith("workspace:")) return spec;
  const at = spec.indexOf("@");
  if (at === 0) {
    const scopeEnd = spec.indexOf("@", 1);
    if (scopeEnd > 0) return spec.slice(0, scopeEnd);
    return spec.slice(0, spec.lastIndexOf("@"));
  }
  return at > 0 ? spec.slice(0, at) : spec;
}

function resolveWorkspace(
  lockfile: Lockfile,
  name: string
): string | undefined {
  for (const [path, pkg] of Object.entries(lockfile.workspaces)) {
    if (pkg.name === name && path.startsWith("packages/")) return path;
  }
  return undefined;
}

function collectTransitive(
  lockfile: Lockfile,
  deps: Record<string, string>,
  visited: Set<string>,
  isProd: boolean
): void {
  for (const [name, spec] of Object.entries(deps)) {
    if (spec.startsWith("workspace:")) {
      const wsPath = resolveWorkspace(lockfile, name);
      if (wsPath && lockfile.workspaces[wsPath]) {
        const ws = lockfile.workspaces[wsPath];
        const key = `ws:${name}`;
        if (visited.has(key)) continue;
        visited.add(key);
        const allDeps = {
          ...ws.dependencies,
          ...(isProd ? {} : ws.devDependencies),
        };
        collectTransitive(lockfile, allDeps, visited, isProd);
      }
      continue;
    }
    const pkgName = getPackageName(spec);
    if (visited.has(pkgName)) continue;
    visited.add(pkgName);
    const pkgEntry = lockfile.packages[pkgName];
    if (pkgEntry && pkgEntry[2]?.dependencies) {
      collectTransitive(lockfile, pkgEntry[2].dependencies, visited, isProd);
    }
  }
}

function countDeps(
  lockfile: Lockfile,
  wsPath: string,
  type: "dependencies" | "devDependencies"
): number {
  const ws = lockfile.workspaces[wsPath];
  if (!ws) return 0;
  const deps = ws[type];
  if (!deps || Object.keys(deps).length === 0) return 0;
  const visited = new Set<string>();
  collectTransitive(lockfile, deps, visited, type === "dependencies");
  return visited.size;
}

function main(): void {
  const content = readFileSync(LOCKFILE, "utf-8");
  const lockfile = parseLockfile(content) as Lockfile;

  const workspacePaths = Object.keys(lockfile.workspaces).filter((p) =>
    p.startsWith("packages/")
  );

  const results: Array<{ name: string; deps: number; devDeps: number }> = [];

  for (const wsPath of workspacePaths.sort()) {
    const ws = lockfile.workspaces[wsPath];
    const name = ws?.name ?? wsPath.replace("packages/", "");
    const deps = countDeps(lockfile, wsPath, "dependencies");
    const devDeps = countDeps(lockfile, wsPath, "devDependencies");
    results.push({ name, deps, devDeps });
  }

  console.log("Package | Dependencies (total) | Dev-dependencies (total)");
  console.log("--------|----------------------|--------------------------");
  for (const { name, deps, devDeps } of results) {
    console.log(`${name} | ${deps} | ${devDeps}`);
  }
}

main();
