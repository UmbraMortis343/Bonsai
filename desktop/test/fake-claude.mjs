#!/usr/bin/env node
// A stand-in for the Claude Code CLI: --version, auth status, and -p with stream-json output.
// It replies "ECHO: <first line of the prompt>" in two streamed pieces, and records its args.
import { appendFileSync } from "node:fs";
const a = process.argv.slice(2);
if (process.env.FAKE_LOG) appendFileSync(process.env.FAKE_LOG, JSON.stringify({ args: a, key: !!process.env.ANTHROPIC_API_KEY, cwd: process.cwd() }) + "\n");
if (a[0] === "--version") { console.log("2.1.0 (Claude Code)"); process.exit(0); }
if (a[0] === "auth") { console.log(JSON.stringify({ loggedIn: process.env.FAKE_SIGNED_OUT ? false : true, authMethod: "claude.ai" })); process.exit(process.env.FAKE_SIGNED_OUT ? 1 : 0); }
let input = ""; process.stdin.on("data", (d) => (input += d)); process.stdin.on("end", async () => {
  if (a.includes("--input-format")) { const m = JSON.parse(input.trim().split("\n")[0]).message, imgs = m.content.filter((c) => c.type === "image"); input = `IMAGES ${imgs.length} ${imgs[0]?.source.media_type}\n` + m.content.find((c) => c.type === "text").text; }
  const reply = process.env.FAKE_REPLY && !input.startsWith("IMAGES") ? process.env.FAKE_REPLY : "ECHO: " + input.split("\n")[0];
  const out = (o) => process.stdout.write(JSON.stringify(o) + "\n");
  out({ type: "system", subtype: "init", session_id: "s1" });
  out({ type: "stream_event", event: { type: "message_start" } });
  const half = Math.ceil(reply.length / 2);
  for (const part of [reply.slice(0, half), reply.slice(half)]) { out({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: part } } }); await new Promise((r) => setTimeout(r, Number(process.env.FAKE_DELAY || 50))); }
  out({ type: "result", subtype: "success", is_error: false, result: reply });
});
