// Tiny static server for local testing. Usage: node scripts/serve.mjs <dir> <port>
// The served folder can be swapped at runtime by writing a new path to <dir>.target
// (used by the update test to simulate a new release).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".mjs": "text/javascript; charset=utf-8", ".wasm": "application/wasm", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

export function serve(getDir, port, base = "/Bonsai/") {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (!p.startsWith(base)) { res.writeHead(302, { Location: base }); return res.end(); }
      p = p.slice(base.length) || "index.html";
      if (p.endsWith("/")) p += "index.html";
      const dir = getDir();
      const file = normalize(join(dir, p));
      if (!file.startsWith(normalize(dir))) { res.writeHead(403); return res.end(); }
      const info = await stat(file);
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Content-Length": info.size, "Cache-Control": "no-cache" });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404); res.end("Not found");
    }
  });
  return new Promise(r => server.listen(port, () => r(server)));
}

if (process.argv[1] && process.argv[1].endsWith("serve.mjs")) {
  const dir = process.argv[2] || "dist", port = Number(process.argv[3] || 4173);
  await serve(() => dir, port);
  console.log(`Serving ${dir} at http://localhost:${port}/Bonsai/`);
}
