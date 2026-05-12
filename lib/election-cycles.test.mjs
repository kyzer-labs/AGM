import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("./election-cycles.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

const encoded = Buffer.from(outputText).toString("base64");
const cycles = await import(`data:text/javascript;base64,${encoded}`);
const {
  canCreateWorkspaceCycle,
  getArchivedCycles,
  getCurrentWorkspaceCycle,
} = cycles;

function cycle(name, phase, createdAt) {
  return { name, phase, createdAt };
}

test("chooses the newest non-published cycle for the workspace", () => {
  const all = [
    cycle("AGM 2024", "published", 300),
    cycle("AGM 2026", "setup", 200),
    cycle("AGM 2025", "published", 100),
  ];

  assert.equal(getCurrentWorkspaceCycle(all)?.name, "AGM 2026");
});

test("returns null when every cycle is published", () => {
  const all = [
    cycle("AGM 2025", "published", 200),
    cycle("AGM 2024", "published", 100),
  ];

  assert.equal(getCurrentWorkspaceCycle(all), null);
});

test("archives include only published cycles newest first", () => {
  const all = [
    cycle("AGM 2024", "published", 100),
    cycle("AGM 2026", "setup", 300),
    cycle("AGM 2025", "published", 200),
  ];

  assert.deepEqual(
    getArchivedCycles(all).map((e) => e.name),
    ["AGM 2025", "AGM 2024"],
  );
});

test("allows cycle creation only when no active workspace cycle exists", () => {
  assert.equal(
    canCreateWorkspaceCycle([
      cycle("AGM 2025", "published", 200),
      cycle("AGM 2024", "published", 100),
    ]),
    true,
  );
  assert.equal(
    canCreateWorkspaceCycle([
      cycle("AGM 2026", "setup", 300),
      cycle("AGM 2025", "published", 200),
    ]),
    false,
  );
});
