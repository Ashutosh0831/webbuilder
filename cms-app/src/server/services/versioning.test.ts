import assert from "node:assert/strict";
import test from "node:test";
import { defaultTokens } from "@/features/themes/default-tokens";
import {
  changedSnapshotKeys,
  themeRevisionSnapshotSchema,
  validatePageRevision,
  websiteRevisionSnapshotSchema,
} from "./versioning";

const pageSnapshot = {
  title: "Home",
  slug: "home",
  seo: null,
  template: null,
  parentId: null,
};

test("validates page-content and builder revision shapes", () => {
  assert.deepEqual(
    validatePageRevision({ sections: [] }, pageSnapshot),
    pageSnapshot
  );
  assert.doesNotThrow(() => validatePageRevision({
    sections: [{
      id: "00000000-0000-4000-8000-000000000001",
      componentKey: "heading",
      props: { text: "Hello" },
      sortOrder: 0,
    }],
  }, pageSnapshot));
});

test("rejects malformed saved content and metadata", () => {
  assert.throws(
    () => validatePageRevision({ sections: [{ no: "id" }] }, pageSnapshot),
    /invalid page content/
  );
  assert.throws(
    () => validatePageRevision({ sections: [] }, { ...pageSnapshot, slug: "" }),
    /invalid page metadata/
  );
});

test("reports only changed top-level revision fields", () => {
  assert.deepEqual(
    changedSnapshotKeys({ title: "Old", slug: "home" }, { title: "New", slug: "home", seo: {} }),
    ["title", "seo"]
  );
});

test("validates website and theme snapshots before they can be restored", () => {
  assert.equal(websiteRevisionSnapshotSchema.safeParse({
    name: "Site",
    slug: "site",
    description: null,
    locale: "en",
    timezone: "UTC",
    settings: { robotsTxt: null, faviconUrl: null, defaultSeo: null },
  }).success, true);
  assert.equal(themeRevisionSnapshotSchema.safeParse({ name: "Default", tokens: defaultTokens }).success, true);
  assert.equal(themeRevisionSnapshotSchema.safeParse({ name: "Invalid", tokens: {} }).success, false);
});
