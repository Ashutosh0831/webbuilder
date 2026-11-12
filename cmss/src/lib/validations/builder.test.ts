import assert from "node:assert/strict";
import test from "node:test";
import { sectionSchema } from "./builder";

const sectionId = "00000000-0000-4000-8000-000000000001";

test("accepts object props and responsive overrides", () => {
  const result = sectionSchema.safeParse({
    id: sectionId,
    componentKey: "heading",
    props: { text: "Hello" },
    responsive: { tablet: { text: "Hi" } },
    sortOrder: 0,
  });

  assert.equal(result.success, true);
});

test("rejects non-object section props", () => {
  for (const props of [null, [], "invalid"]) {
    const result = sectionSchema.safeParse({
      id: sectionId,
      componentKey: "heading",
      props,
      sortOrder: 0,
    });

    assert.equal(result.success, false);
  }
});
