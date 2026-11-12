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
  addChildSection: (parentId: string, componentKey: string) => void;
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

      addChildSection: (parentId, componentKey) => {
        const def = componentRegistry[componentKey];
        if (!def) return;
        const child: BuilderSection = {
          id: crypto.randomUUID(), componentKey, props: def.defaultProps,
          sortOrder: 0, children: [],
        };
        const insert = (items: BuilderSection[]): BuilderSection[] => items.map((item) => {
          if (item.id === parentId) return { ...item, children: [...(item.children ?? []), { ...child, sortOrder: item.children?.length ?? 0 }] };
          return item.children?.length ? { ...item, children: insert(item.children) } : item;
        });
        set((state) => ({ sections: insert(state.sections), selectedId: child.id }));
        get().scheduleAutosave();
      },

      removeSection: (id) => {
        const remove = (items: BuilderSection[]): BuilderSection[] => items
          .filter((item) => item.id !== id)
          .map((item, index) => ({
            ...item,
            sortOrder: index,
            ...(item.children ? { children: remove(item.children) } : {}),
          }));
        set((state) => ({
          sections: remove(state.sections),
          selectedId: state.selectedId === id ? null : state.selectedId,
        }));
        get().scheduleAutosave();
      },

      duplicateSection: (id) => {
        let duplicatedId: string | null = null;
        const clone = (item: BuilderSection): BuilderSection => {
          const nextId = crypto.randomUUID();
          if (item.id === id) duplicatedId = nextId;
          return {
            ...item,
            id: nextId,
            props: structuredClone(item.props),
            responsive: item.responsive ? structuredClone(item.responsive) : undefined,
            children: item.children?.map(clone) ?? [],
          };
        };
        const duplicateIn = (items: BuilderSection[]): BuilderSection[] => {
          const result: BuilderSection[] = [];
          for (const item of items) {
            result.push({ ...item, children: item.children?.length ? duplicateIn(item.children) : [] });
            if (item.id === id) result.push(clone(item));
          }
          return result.map((item, index) => ({ ...item, sortOrder: index }));
        };
        set((state) => ({ sections: duplicateIn(state.sections), selectedId: duplicatedId ?? state.selectedId }));
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
        const update = (items: BuilderSection[]): BuilderSection[] => items.map((item) => item.id === id
          ? { ...item, props }
          : { ...item, children: item.children?.length ? update(item.children) : item.children });
        set((state) => ({ sections: update(state.sections) }));
        get().scheduleAutosave();
      },
      setSaveStatus: (saveStatus) => set({ saveStatus, lastSavedAt: saveStatus === "saved" ? new Date() : get().lastSavedAt }),
      setVersion: (v) => set({ version: v }),

      updateSectionPropsForBreakpoint: (id, breakpoint, nextProps) => {
        const update = (items: BuilderSection[]): BuilderSection[] => items.map((item) => {
          if (item.id === id) {
            if (breakpoint === "mobile") return { ...item, props: nextProps };
            return { ...item, responsive: {
              ...item.responsive,
              [breakpoint]: { ...item.responsive?.[breakpoint], ...nextProps },
            } };
          }
          return { ...item, children: item.children?.length ? update(item.children) : item.children };
        });
        set((state) => ({ sections: update(state.sections) }));
        get().scheduleAutosave();
      },

      clearBreakpointOverride: (id, breakpoint) => {
        if (breakpoint === "mobile") return;
        const update = (items: BuilderSection[]): BuilderSection[] => items.map((item) => {
          if (item.id === id && item.responsive?.[breakpoint]) {
            const responsive = { ...item.responsive };
            delete responsive[breakpoint];
            return { ...item, responsive };
          }
          return { ...item, children: item.children?.length ? update(item.children) : item.children };
        });
        set((state) => ({ sections: update(state.sections) }));
        get().scheduleAutosave();
      },

      scheduleAutosave: () => {
        const existing = get().autosaveTimer;
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          // The actual save is triggered by AutosaveManager, which has access
          // to the server action.
          set({ saveStatus: "saving", autosaveTimer: null });
        }, 3000);
        set({ autosaveTimer: timer, saveStatus: "idle" });
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