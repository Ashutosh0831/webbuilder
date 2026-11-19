import assert from "node:assert/strict";
import test from "node:test";
import { interpolate, resolveSitePlaceholders, resolveSitePlaceholdersDeep } from "./interpolate.js";
import { resolveSeo } from "./seo.js";

test("resolveSitePlaceholders replaces bracketed site variables", () => {
  const settings = {
    brand_name: "ABC Pest Control",
    phone: "+1-555-0199",
    contact_email: "hello@abcpest.example",
    address: "123 Main St, Springfield",
    public_url: "https://abcpest.example",
  };
  const out = resolveSitePlaceholders(
    "Call [COMPANY_NAME] at [PHONE_NUMBER] or email [EMAIL] at [BUSINESS_ADDRESS] ([WEBSITE_URL]).",
    settings
  );
  assert.equal(
    out,
    "Call ABC Pest Control at +1-555-0199 or email hello@abcpest.example at 123 Main St, Springfield (https://abcpest.example)."
  );
});

test("resolveSitePlaceholdersDeep walks nested objects and arrays", () => {
  const res = resolveSitePlaceholdersDeep(
    { hero: { h1: "Welcome to [COMPANY_NAME]" }, items: ["Call [PHONE_NUMBER]"] },
    { brand_name: "Acme", phone: "555-1234" }
  );
  assert.deepEqual(res, {
    hero: { h1: "Welcome to Acme" },
    items: ["Call 555-1234"],
  });
});

test("interpolate resolves {{...}} and reports missing keys", () => {
  const res = interpolate("Hi {{brand_name}}, missing {{unknown_key}}", {
    entry: {},
    siteSettings: { brand_name: "Acme" },
    globalSettings: {},
  });
  assert.equal(res.resolved, "Hi Acme, missing {{unknown_key}}");
  assert.deepEqual(res.missing, ["unknown_key"]);
});

test("resolveSeo follows manual -> template -> site -> fallback chain", () => {
  const seo = resolveSeo({
    manual: {},
    template: { titleTemplate: "{{title}} | {{brand_name}}" },
    siteDefaults: { seoDescription: "Default desc" },
    ctx: { entry: { title: "Termites" }, siteSettings: { brand_name: "Acme" }, globalSettings: {} },
    canonicalUrl: "https://acme.example/services/termites",
  });
  assert.equal(seo.title, "Termites | Acme");
  assert.equal(seo.description, "Default desc");
  assert.equal(seo.canonical, "https://acme.example/services/termites");
  assert.equal(seo.robots, "index,follow");
});
