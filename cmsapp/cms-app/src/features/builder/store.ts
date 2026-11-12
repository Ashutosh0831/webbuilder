import { create } from "zustand";
import { temporal } from "zundo";
import { componentRegistry } from "@/features/components/registry";
import type { Breakpoint, BuilderSection } from "./types";

interface BuilderState {
  websiteId: string;
  pageId: string;
  pageTitle: string;
  sections: BuilderSection[];
  selectedId: string | null;
  device: "desktop" | "tablet" | "mobile";
  saveStatus: "idle" | "saving" | "saved" | "error" | "conflict";
  lastSavedAt: Date | null;
  version: number;           // server-side optimistic lock
  autosaveTimer: ReturnType<typeof setTimeout> | null;
}

interface BuilderActions {
  addSection: (componentKey: string) => void;
  removeSection: (id: string) => void;
  duplicateSection: (id: string) => void;
  reorderSections: (activeId: string, overId: string) => void;
  selectSection: (id: string | null) => void;
  setDevice: (device: BuilderState["device"]) => void;
  updateSectionProps: (id: string, props: Record<string, unknown>) => void;
  setSaveStatus: (status: BuilderState["saveStatus"]) => void;
  setVersion: (v: number) => void;
  scheduleAutosave: () => void;
  updateSectionPropsForBreakpoint: (
    id: string,
    breakpoint: Breakpoint,
    props: Record<string, unknown>
  ) => void;
  clearBreakpointOverride: (id: string, breakpoint: Breakpoint) => void;
}

export const useBuilderStore = create<BuilderState & BuilderActions>()(
  temporal(
    (set, get) => ({
      websiteId: "",
      pageId: "",
      pageTitle: "",
      sections: [],
      selectedId: null,
      device: "desktop",
      saveStatus: "idle",
      lastSavedAt: null,
      version: 0,
      autosaveTimer: null,

      addSection: (componentKey) => {
        const def = componentRegistry[componentKey];
        if (!def) return;
        const section: BuilderSection = {
          id: crypto.randomUUID(),
          componentKey,
          props: def.defaultProps,
          sortOrder: get().sections.length,
          children: [],
        };
        set((s) => ({ sections: [...s.sections, section], selectedId: section.id }));
        get().scheduleAutosave();
      },

      removeSection: (id) => {
        set((s) => ({
          sections: s.sections.filter((x) => x.id !== id).map((x, i) => ({ ...x, sortOrder: i })),
          selectedId: s.selectedId === id ? null : s.selectedId,
        }));
        get().scheduleAutosave();
      },

      duplicateSection: (id) => {
        set((s) => {
          const idx = s.sections.findIndex((x) => x.id === id);
          if (idx < 0) return s;
          const copy = { ...s.sections[idx], id: crypto.randomUUID() };
          const next = [...s.sections];
          next.splice(idx + 1, 0, copy);
          return { sections: next.map((x, i) => ({ ...x, sortOrder: i })), selectedId: copy.id };
        });
        get().scheduleAutosave();
      },

      reorderSections: (activeId, overId) => {
        set((s) => {
          const oldIdx = s.sections.findIndex((x) => x.id === activeId);
          const newIdx = s.sections.findIndex((x) => x.id === overId);
          if (oldIdx < 0 || newIdx < 0) return s;
          const next = [...s.sections];
          const [moved] = next.splice(oldIdx, 1);
          next.splice(newIdx, 0, moved);
          return { sections: next.map((x, i) => ({ ...x, sortOrder: i })) };
        });
        get().scheduleAutosave();
      },

      selectSection: (id) => set({ selectedId: id }),
      setDevice: (device) => set({ device }),
      updateSectionProps: (id, props) => {
        set((s) => ({
          sections: s.sections.map((x) => (x.id === id ? { ...x, props } : x)),
        }));
        get().scheduleAutosave();
      },
      setSaveStatus: (saveStatus) => set({ saveStatus, lastSavedAt: saveStatus === "saved" ? new Date() : get().lastSavedAt }),
      setVersion: (v) => set({ version: v }),

      updateSectionPropsForBreakpoint: (id, breakpoint, nextProps) => {
        set((s) => ({
          sections: s.sections.map((x) => {
            if (x.id !== id) return x;
            if (breakpoint === "mobile") {
              return { ...x, props: nextProps };
            }
            return {
              ...x,
              responsive: {
                ...x.responsive,
                [breakpoint]: {
                  ...x.responsive?.[breakpoint],
                  ...nextProps,
                },
              },
            };
          }),
        }));
        get().scheduleAutosave();
      },

      clearBreakpointOverride: (id, breakpoint) => {
        if (breakpoint === "mobile") return;
        set((s) => ({
          sections: s.sections.map((x) => {
            if (x.id !== id || !x.responsive?.[breakpoint]) return x;
            const responsive = { ...x.responsive };
            delete responsive[breakpoint];
            return { ...x, responsive };
          }),
        }));
        get().scheduleAutosave();
      },

      scheduleAutosave: () => {
        const existing = get().autosaveTimer;
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          // The actual save is triggered by the component, not the store,
          // because it needs access to the server action.
          set({ saveStatus: "saving" });
        }, 3000);
        set({ autosaveTimer: timer });
      },
    }),
    {
      partialize: (state) => ({ sections: state.sections }),
      limit: 50, // cap history size
      equality: (a, b) => JSON.stringify(a.sections) === JSON.stringify(b.sections),
    }
  )
);

// Access undo/redo
export const useTemporalStore = useBuilderStore.temporal;