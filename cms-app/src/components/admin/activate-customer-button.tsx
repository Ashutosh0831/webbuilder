"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { activateCustomerAction } from "@/server/actions/customer";
import { Button } from "@/components/ui/button";

export function ActivateCustomerButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function activate() {
    setBusy(true);
    try {
      const result = await activateCustomerAction(customerId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Customer activated.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" onClick={activate} disabled={busy}>
      {busy ? "Activating..." : "Activate customer"}
    </Button>
  );
}
