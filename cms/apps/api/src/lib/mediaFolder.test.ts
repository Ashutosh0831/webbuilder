import assert from "node:assert/strict";
import test from "node:test";
import { InvalidMediaFolderError, normalizeMediaFolder } from "./mediaFolder.js";

test("normalizes media folder paths while preserving nested folders", () => {
  assert.equal(normalizeMediaFolder("  Services / Pest Control/  "), "Services/Pest Control");
  assert.equal(normalizeMediaFolder(String.raw`Services\Pest Control`), "Services/Pest Control");
  assert.equal(normalizeMediaFolder(""), "");
});

test("rejects media folder traversal, control characters, and oversized names", () => {
  assert.throws(() => normalizeMediaFolder("../private"), InvalidMediaFolderError);
  assert.throws(() => normalizeMediaFolder("Images/../private"), InvalidMediaFolderError);
  assert.throws(() => normalizeMediaFolder("bad\nfolder"), InvalidMediaFolderError);
  assert.throws(() => normalizeMediaFolder("x".repeat(81)), InvalidMediaFolderError);
  assert.throws(() => normalizeMediaFolder(`a/${"x".repeat(81)}`), InvalidMediaFolderError);
});
