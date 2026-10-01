const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

test("shared edits and favicon refresh", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "homebase-test-"));
  const fixture = http.createServer();
  fixture.listen(0, "127.0.0.1");
  await once(fixture, "listening");
  const fixtureUrl = `http://127.0.0.1:${fixture.address().port}`;
  const reserve = http.createServer();
  reserve.listen(0, "127.0.0.1");
  await once(reserve, "listening");
  const port = reserve.address().port;
  await new Promise((resolve) => reserve.close(resolve));
  const child = spawn(process.execPath, [path.join(__dirname, "../server.js")], {
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), DATA_DIR: directory, ADMIN_PASSWORD: "" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  t.after(async () => {
    child.kill();
    if (child.exitCode === null) await once(child, "exit");
    await new Promise((resolve) => fixture.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    child.stdout.on("data", (data) => { if (String(data).includes("Homebase running")) resolve(); });
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`server exited: ${code}`)));
  });
  const api = async (endpoint = "/api/homebase", method = "GET", body) => {
    const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
      method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body)
    });
    return { status: response.status, data: await response.json() };
  };
  const edit = (base) => ({ ...structuredClone(base), base: structuredClone(base) });
  await api("/api/setup", "POST", { title: "Test", profileName: "Test", categories: ["Links"] });
  const initial = (await api()).data;
  const seed = edit(initial);
  seed.profiles[0].links = ["a", "b"].map((id) => ({ id, title: id, category: "Links", url: `${fixtureUrl}/${id}` }));
  assert.equal((await api("/api/homebase", "PUT", seed)).status, 200);
  const base = (await api()).data;
  const deletion = edit(base);
  deletion.profiles[0].links = deletion.profiles[0].links.filter((link) => link.id !== "a");
  assert.equal((await api("/api/homebase", "PUT", deletion)).status, 200);
  const other = edit(base);
  other.profiles[0].links.find((link) => link.id === "b").title = "Changed B";
  const merged = await api("/api/homebase", "PUT", other);
  assert.equal(merged.status, 200);
  assert.deepEqual(merged.data.profiles[0].links.map((link) => link.id), ["b"]);
  assert.equal(merged.data.profiles[0].links[0].title, "Changed B");
  const settings = { base, revision: base.revision, title: "Settings change", widgets: base.widgets, appearance: base.appearance };
  assert.equal((await api("/api/homebase/settings", "PUT", settings)).status, 200);
  assert.equal((await api()).data.profiles[0].links.length, 1);
  const resurrection = edit(base);
  resurrection.profiles[0].links[0].title = "Stale edit of deleted A";
  assert.equal((await api("/api/homebase", "PUT", resurrection)).status, 409);
  assert.equal((await api()).data.profiles[0].links.length, 1);
  const shared = (await api()).data;
  const first = edit(shared), second = edit(shared);
  first.profiles[0].links[0].title = "First";
  second.profiles[0].links[0].title = "Second";
  assert.equal((await api("/api/homebase", "PUT", first)).status, 200);
  assert.equal((await api("/api/homebase", "PUT", second)).status, 409);
  assert.equal((await api("/api/homebase", "PUT", shared)).status, 428);
  const additions = (await api()).data;
  const left = edit(additions), right = edit(additions);
  left.profiles[0].links.push({ id: "c", title: "C", category: "Links", url: `${fixtureUrl}/c` });
  right.profiles[0].links.push({ id: "d", title: "D", category: "Links", url: `${fixtureUrl}/d` });
  const results = await Promise.all([api("/api/homebase", "PUT", left), api("/api/homebase", "PUT", right)]);
  assert.deepEqual(results.map((result) => result.status), [200, 200]);
  assert.deepEqual((await api()).data.profiles[0].links.map((link) => link.id).sort(), ["b", "c", "d"]);

  let icon = Buffer.from([0, 0, 1, 0, 1, 0, 12]);
  let available = true;
  fixture.on("request", (req, res) => {
    if (req.url === "/a" || req.url === "/missing") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end('<link rel="icon" href="http://["><link rel="icon" href="/custom.ico">');
    } else if (req.url === "/custom.ico" && available) {
      res.writeHead(200, { "Content-Type": "application/octet-stream" });
      res.end(icon);
    } else { res.writeHead(404); res.end(); }
  });
  const favicon = async (target) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/favicon?url=${encodeURIComponent(target)}`);
    return { headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
  };
  const fetched = await favicon(`${fixtureUrl}/a`);
  assert.equal(fetched.headers.get("content-type"), "image/x-icon");
  assert.deepEqual(fetched.bytes, icon);
  const key = crypto.createHash("sha256").update(`${fixtureUrl}/a`).digest("hex");
  const metadataPath = path.join(directory, "favicons", `${key}.json`);
  fs.writeFileSync(metadataPath, JSON.stringify({ contentType: "image/x-icon", updatedAt: 1 }));
  icon = Buffer.from([0, 0, 1, 0, 1, 0, 99]);
  assert.deepEqual((await favicon(`${fixtureUrl}/a`)).bytes, icon);
  available = false;
  const fallback = await favicon(`${fixtureUrl}/missing`);
  assert.equal(fallback.headers.get("cache-control"), "no-store");
  available = true;
  assert.deepEqual((await favicon(`${fixtureUrl}/missing`)).bytes, icon);
});
