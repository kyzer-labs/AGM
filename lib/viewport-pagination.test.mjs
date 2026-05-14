import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("./viewport-pagination.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

const encoded = Buffer.from(outputText).toString("base64");
const pagination = await import(`data:text/javascript;base64,${encoded}`);
const { getGridPageSizeForMediaHeight, getPageSizeForMediaHeight } =
  pagination;

test("sizes a page from media height and row height", () => {
  assert.equal(
    getPageSizeForMediaHeight({
      mediaHeight: 480,
      rowHeight: 60,
      minRows: 3,
    }),
    8,
  );
});

test("keeps a usable minimum for short media", () => {
  assert.equal(
    getPageSizeForMediaHeight({
      mediaHeight: 120,
      rowHeight: 60,
      minRows: 3,
    }),
    3,
  );
});

test("falls back when measurements are not ready", () => {
  assert.equal(
    getPageSizeForMediaHeight({
      mediaHeight: 0,
      rowHeight: 60,
      minRows: 3,
      fallbackRows: 6,
    }),
    6,
  );
});

test("sizes a grid page from visible rows and columns", () => {
  assert.equal(
    getGridPageSizeForMediaHeight({
      mediaHeight: 330,
      rowHeight: 150,
      columns: 2,
      minRows: 1,
    }),
    4,
  );
});

test("keeps one complete grid row when the media is short", () => {
  assert.equal(
    getGridPageSizeForMediaHeight({
      mediaHeight: 100,
      rowHeight: 150,
      columns: 2,
      minRows: 1,
    }),
    2,
  );
});
