"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface DeleteButtonProps {
  id: string;
  websiteId?: string;
  type: "website" | "page";
  action: (id: string, websiteId?: string) => Promise<{ success?: boolean; error?: string }>;
}

export function DeleteButton({ id, websiteId, type, action }: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    
    setIsDeleting(true);
    const res = await action(id, websiteId);
    setIsDeleting(false);

    if (res.error) toast.error(res.error);
    else toast.success(`${type} deleted`);
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={isDeleting}
      aria-label={`Delete ${type}`}
      title={`Delete ${type}`}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}