"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const LeadSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  phone: z.string().trim().min(10, "Phone must be at least 10 digits").max(15),
  postalCode: z.string().trim().min(4, "Postal code is too short").max(10),
  pestProblem: z.string().trim().min(1, "Please select a pest problem").max(100),
});

export type LeadActionResult =
  | { success: true }
  | { success: false; error: string };

export async function submitLead(formData: FormData): Promise<LeadActionResult> {
  const parsed = LeadSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    postalCode: formData.get("postalCode"),
    pestProblem: formData.get("pestProblem"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    name: parsed.data.name,
    phone: parsed.data.phone,
    postal_code: parsed.data.postalCode,
    pest_problem: parsed.data.pestProblem,
  });

  if (error) {
    console.error("Lead insert failed:", error);
    return { success: false, error: "Could not save your request. Please call us instead." };
  }

  return { success: true };
}