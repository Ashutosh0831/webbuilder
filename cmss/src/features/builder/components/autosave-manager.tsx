"use client";

import { useEffect, useRef } from "react";
import { useBuilderStore } from "../store";
import { saveDraftAction } from "@/server/actions/builder";

export function AutosaveManager() {
  const { sections, pageId, websiteId, version, saveStatus, setSaveStatus, setVersion } = useBuilderStore();
  const savingRef = useRef(false);

  useEffect(() => {
    // Only fire when the timer has elapsed and status is "saving"
    if (saveStatus !== "saving" || savingRef.current) return;
    if (!pageId || !websiteId) return;

    savingRef.current = true;
    const pendingTimer = useBuilderStore.getState().autosaveTimer;
    if (pendingTimer) clearTimeout(pendingTimer);
    useBuilderStore.setState({ autosaveTimer: null });

    async function save() {
      try {
        const result = await saveDraftAction({ pageId, websiteId, version, sections });
        if (result.error === "conflict") {
          setSaveStatus("conflict");
        } else if (!result.success || typeof result.newVersion !== "number") {
          setSaveStatus("error");
        } else {
          setVersion(result.newVersion);
          setSaveStatus("saved");
        }
      } catch {
        setSaveStatus("error");
      } finally {
        savingRef.current = false;
      }
    }

    save();
  }, [saveStatus, pageId, websiteId, version, sections, setSaveStatus, setVersion]);

  return null;
}