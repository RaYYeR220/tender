// Calls one tool on the built plugin over stdio, the way the PayBox host does:
// one process per operation, MCP 2026-07-28 request metadata, newline-delimited JSON.
// Usage: node scripts/call.mjs <tool> '<json arguments>'
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const [tool, args = "{}"] = process.argv.slice(2);
const bundle = fileURLToPath(new URL("../plugin/dist/plugin.mjs", import.meta.url));

export async function call(name, input, method = "tools/call") {
  const child = spawn(process.execPath, [bundle], { stdio: ["pipe", "pipe", "inherit"] });
  const lines = createInterface({ input: child.stdout });
  const params = method === "tools/call" ? { name, arguments: input } : {};
  child.stdin.write(`${JSON.stringify({
    jsonrpc: "2.0", id: 1, method,
    params: { ...params, _meta: {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": { name: "tender-local", version: "0.1.0" },
      "io.modelcontextprotocol/clientCapabilities": {},
    } },
  })}\n`);
  for await (const line of lines) {
    const message = JSON.parse(line);
    if (message.id === 1) {
      child.kill();
      return message;
    }
  }
  throw new Error("plugin exited without a response");
}

if (tool) {
  const started = Date.now();
  const message = tool === "list" ? await call(null, null, "tools/list") : await call(tool, JSON.parse(args));
  console.log(JSON.stringify(message.result ?? message.error, null, 2));
  console.error(`(${Date.now() - started} ms)`);
}
