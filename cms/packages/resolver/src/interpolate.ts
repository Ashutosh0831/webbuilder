export interface InterpolationContext {
  entry: Record<string, unknown>;
  siteSettings: Record<string, unknown>;
  globalSettings: Record<string, unknown>;
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function lookupPath(
  path: string,
  ctx: InterpolationContext
): { value: unknown; source: string } {
  const [head, ...rest] = path.split(".");
  const subPath = rest.join(".");

  const tryPath = (obj: Record<string, unknown>): unknown => {
    if (!subPath) return obj[head];
    let cur: unknown = obj;
    for (const part of [head, ...rest]) {
      if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return cur;
  };

  const entryVal = tryPath(ctx.entry);
  if (entryVal !== undefined && entryVal !== null) {
    return { value: entryVal, source: "entry" };
  }
  const siteVal = tryPath(ctx.siteSettings);
  if (siteVal !== undefined && siteVal !== null) {
    return { value: siteVal, source: "site" };
  }
  const globalVal = tryPath(ctx.globalSettings);
  if (globalVal !== undefined && globalVal !== null) {
    return { value: globalVal, source: "global" };
  }
  return { value: undefined, source: "missing" };
}

/**
 * Interpolate {{placeholders}} in a template string.
 * Resolution order: entry → siteSettings → globalSettings.
 * Missing placeholders are left as-is so failures are visible.
 */
export function interpolate(
  template: string,
  ctx: InterpolationContext
): { resolved: string; missing: string[] } {
  const missing: string[] = [];
  const resolved = template.replace(PLACEHOLDER_RE, (full, path: string) => {
    const { value, source } = lookupPath(path, ctx);
    if (source === "missing" || value === undefined || value === null) {
      missing.push(path);
      return full;
    }
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
  return { resolved, missing };
}

/**
 * Recursively walk an object and interpolate every string field.
 */
export function interpolateDeep(
  obj: unknown,
  ctx: InterpolationContext
): { resolved: unknown; missing: string[] } {
  const allMissing: string[] = [];

  const walk = (val: unknown): unknown => {
    if (typeof val === "string") {
      const { resolved, missing } = interpolate(val, ctx);
      allMissing.push(...missing);
      return resolved;
    }
    if (Array.isArray(val)) return val.map(walk);
    if (val && typeof val === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) {
        out[k] = walk(v);
      }
      return out;
    }
    return val;
  };

  return { resolved: walk(obj), missing: allMissing };
}