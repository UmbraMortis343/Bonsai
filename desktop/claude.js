// Asking Claude through the Claude Code CLI on this computer (`claude -p`), so replies come out of the plan
// Claude Code is signed in with. Ported from Marginalia's src/main/claude.js (its "claude-code" engine),
// without web tools or resumed sessions: Bonsai's asks are one message, one reply.
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TIMEOUT_MS = 5 * 60 * 1000;
const running = new Map();   // reqId -> child process
let dataDir = os.tmpdir();
const setDataDir = (d) => { dataDir = d; };

function candidatePaths() {
  const home = os.homedir();
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    const roaming = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    return [path.join(home, ".local", "bin", "claude.exe"), path.join(local, "Microsoft", "WinGet", "Links", "claude.exe"), path.join(roaming, "npm", "claude.cmd")];
  }
  return [path.join(home, ".local", "bin", "claude"), "/opt/homebrew/bin/claude", "/usr/local/bin/claude", "/usr/bin/claude"];
}
function whichClaude() {
  return new Promise((resolve) => {
    execFile(process.platform === "win32" ? "where" : "which", ["claude"], { timeout: 5000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null);
      const lines = String(stdout).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      resolve(lines.find((l) => /\.exe$/i.test(l)) || lines[0] || null);
    });
  });
}
async function findCli() {
  if (process.env.BONSAI_CLAUDE) return process.env.BONSAI_CLAUDE;   // tests
  for (const p of candidatePaths()) if (fs.existsSync(p)) return p;
  return whichClaude();
}
// Drop ANTHROPIC_API_KEY so Claude Code signs in with the Claude account instead of billing an API key.
function cliEnv() { const env = { ...process.env }; delete env.ANTHROPIC_API_KEY; delete env.ELECTRON_RUN_AS_NODE; return env; }
// A quiet folder to run in, so no project's CLAUDE.md, hooks or MCP servers load.
function workDir() { const d = path.join(dataDir, "claude-workspace"); fs.mkdirSync(d, { recursive: true }); return d; }
function spawnCli(bin, args, opts) {
  if (!/\.(cmd|bat)$/i.test(bin)) return spawn(bin, args, { ...opts, windowsHide: true });
  const q = (a) => '"' + String(a).replace(/"/g, '""') + '"';   // .cmd shims need a shell on Windows
  return spawn([q(bin), ...args.map(q)].join(" "), { ...opts, shell: true, windowsHide: true });
}
function runQuick(bin, args, timeout = 15000) {
  return new Promise((resolve) => {
    let out = "", err = "", child;
    try { child = spawnCli(bin, args, { cwd: workDir(), env: cliEnv() }); } catch (e) { return resolve({ code: -1, out, err: e.message }); }
    const t = setTimeout(() => { try { child.kill(); } catch {} }, timeout);
    child.stdout.on("data", (d) => (out += d)); child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { clearTimeout(t); resolve({ code: -1, out, err: e.message }); });
    child.on("close", (code) => { clearTimeout(t); resolve({ code, out, err }); });
  });
}

let cache = null;
async function status(force) {
  if (cache && !force && Date.now() - cache.at < 60000) return cache.value;
  const bin = await findCli();
  let value;
  if (!bin) value = { found: false };
  else {
    const v = await runQuick(bin, ["--version"]);
    const a = await runQuick(bin, ["auth", "status"]);
    let auth = {}; try { auth = JSON.parse(a.out); } catch {}
    value = { found: v.code === 0 || a.code === 0, version: (v.out.match(/\d+\.\d+\.\d+/) || [null])[0], loggedIn: a.code === 0 && auth.loggedIn !== false };
  }
  cache = { at: Date.now(), value };
  return value;
}

function systemFile(system) {
  const file = path.join(workDir(), "system-" + crypto.createHash("sha1").update(system).digest("hex").slice(0, 12) + ".txt");
  if (!fs.existsSync(file)) fs.writeFileSync(file, system, "utf8");
  return file;
}
// req: { reqId, system, prompt }. emit({ reqId, type: "text", text }) as the reply streams.
async function ask(req, emit) {
  const bin = await findCli();
  if (!bin) return { ok: false, code: "no_cli", message: "Claude Code isn't on this computer. Install it from claude.com/code, then sign in." };
  return new Promise((resolve) => {
    const args = ["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages", "--system-prompt-file", systemFile(String(req.system || "")),
      "--tools", "", "--strict-mcp-config", "--max-turns", "2", "--no-session-persistence"];
    let child;
    try { child = spawnCli(bin, args, { cwd: workDir(), env: cliEnv(), stdio: ["pipe", "pipe", "pipe"] }); }
    catch (e) { return resolve({ ok: false, code: "cli_failed", message: "Couldn't start Claude Code: " + e.message }); }
    running.set(req.reqId, child);
    let buf = "", text = "", result = null, stderr = "";
    const timer = setTimeout(() => { try { child.kill(); } catch {} }, TIMEOUT_MS);
    const onLine = (line) => {
      let d; try { d = JSON.parse(line); } catch { return; }
      if (d.type === "stream_event" && d.event) {
        const ev = d.event;
        if (ev.type === "message_start") text = "";
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") { text += ev.delta.text; emit({ reqId: req.reqId, type: "text", text }); }
      } else if (d.type === "result") result = d;
    };
    child.stdout.on("data", (chunk) => { buf += chunk; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) onLine(line); } });
    child.stderr.on("data", (d) => { stderr = (stderr + d).slice(-4000); });
    child.on("error", (e) => { stderr += e.message; });
    child.on("close", (code) => {
      clearTimeout(timer); running.delete(req.reqId);
      if (buf.trim()) onLine(buf.trim());
      if (child.killed && !result) return resolve({ ok: false, code: "cancelled", message: "Stopped." });
      if (result && !result.is_error && result.subtype === "success") return resolve({ ok: true, text: String(result.result || text).trim() });
      const detail = (typeof result?.result === "string" && result.result) || stderr.trim() || "Claude Code exited with code " + code;
      const auth = /log ?in|sign ?in|auth|credential|401/i.test(detail);
      resolve({ ok: false, code: auth ? "not_signed_in" : "cli_error", message: auth ? "Claude Code isn't signed in. Open a terminal, run claude, and sign in with your Claude account." : detail.slice(0, 600) });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(String(req.prompt || ""));
  });
}
function cancel(reqId) { const c = running.get(reqId); if (c) { try { c.kill(); } catch {} } }

module.exports = { ask, cancel, status, setDataDir };
