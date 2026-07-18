/**
 * Node --test resolve hook: let `node --test` load TS source modules that use
 * bundler-style extensionless relative imports.
 *
 * The core package (`"type": "module"`) is authored for `moduleResolution:
 * "Bundler"`, so its source files import siblings WITHOUT a `.ts` extension
 * (e.g. `import { usdToCents } from "./discover"`). Node's ESM loader — even
 * with built-in type stripping — uses strict resolution and won't append the
 * extension, so a `node --test` file that transitively loads such a module
 * fails with ERR_MODULE_NOT_FOUND. Colocated `*.test.ts` files already use
 * explicit `.ts` specifiers; this hook covers the source modules they import.
 *
 * Scope is deliberately tiny: only relative specifiers, only when no known
 * extension is present, and only when the `.ts` (or `.tsx`) file actually
 * exists on disk. Everything else falls through to Node's default resolver, so
 * package imports and already-extensioned specifiers are untouched.
 *
 * Usage: node --import ./scripts/node-test-resolve-ts.mjs --test <files...>
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HAS_EXT = /\.[cm]?[jt]sx?$|\.json$/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && !HAS_EXT.test(specifier)) {
      for (const ext of [".ts", ".tsx"]) {
        try {
          const candidate = new URL(specifier + ext, context.parentURL);
          if (existsSync(fileURLToPath(candidate))) {
            return nextResolve(specifier + ext, context);
          }
        } catch {
          // fall through to default resolution
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
