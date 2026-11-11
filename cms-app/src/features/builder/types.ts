export interface BuilderState {
  websiteId: string;
  pageId: string;
  pageTitle: string;
  sections: BuilderSection[];
  selectedId: string | null;
  device: "desktop" | "tablet" | "mobile";
  saveStatus: "idle" | "saving" | "saved" | "error";
  lastSavedAt: Date | null;
}

export type Breakpoint = "mobile" | "tablet" | "desktop";

export interface BuilderSection {
  id: string;
  componentKey: string;
  props: Record<string, unknown>;           // base = mobile
  responsive?: Partial<Record<Exclude<Breakpoint, "mobile">, Record<string, unknown>>>;
  sortOrder: number;
  children?: BuilderSection[];
}