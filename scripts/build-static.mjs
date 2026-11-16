// Builds a static copy of the site (demo mode) into ./out for hosts without a server,
// such as GitHub Pages. Server-only parts are left out; the app hides features that need them.
//   NEXT_PUBLIC_BASE_PATH=/Newweb node scripts/build-static.mjs
import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const work = mkdtempSync(join(tmpdir(), "peloton-static-"));
const skip = ["node_modules", ".next", "out", ".git", "test-results", "screenshots", "peloton-ai.zip"];
const serverOnly = ["src/app/api", "src/app/share", "src/app/auth", "src/middleware.ts"];

cpSync(root, work, {
  recursive: true,
  filter: (src) => {
    const rel = relative(root, src);
    if (!rel) return true;
    if (skip.some((s) => rel === s || rel.startsWith(s + "/"))) return false;
    if (/^\.env/.test(rel)) return false; // never bake local secrets/backends into a public build
    return !serverOnly.some((s) => rel === s || rel.startsWith(s + "/"));
  },
});
symlinkSync(join(root, "node_modules"), join(work, "node_modules"), "dir");

const env = {
  ...process.env,
  STATIC_EXPORT: "1",
  NEXT_PUBLIC_STATIC_EXPORT: "1",
  NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
};
execSync("npx next build", { cwd: work, env, stdio: "inherit" });

const out = join(root, "out");
if (existsSync(out)) rmSync(out, { recursive: true });
cpSync(join(work, "out"), out, { recursive: true });
writeFileSync(join(out, ".nojekyll"), ""); // GitHub Pages: serve the _next/ folder
rmSync(work, { recursive: true, force: true });
console.log(`Static site ready in ${relative(process.cwd(), out)}/`);
