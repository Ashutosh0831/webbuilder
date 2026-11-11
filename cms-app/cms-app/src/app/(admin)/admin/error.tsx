"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <h2 className="text-xl font-semibold">Failed to load dashboard</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset} className="mt-4">Retry</Button>
    </div>
  );
}