import { build } from "esbuild";
await build({entryPoints:["src/worker.ts","scripts/migrate.ts","scripts/provision-role.ts"],outdir:"dist-runtime",outbase:".",outExtension:{".js":".mjs"},bundle:true,packages:"external",platform:"node",format:"esm",target:"node24"});
