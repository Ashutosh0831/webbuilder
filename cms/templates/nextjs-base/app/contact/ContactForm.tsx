"use client";
import { useState } from "react";

export function ContactForm({
  formKey,
  schema,
}: {
  formKey: string;
  schema: any;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    fd.forEach((v, k) => (data[k] = String(v)));

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_CMS_API_URL}/api/v1/sites/${process.env.NEXT_PUBLIC_CMS_SITE_SLUG}/forms/${formKey}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.NEXT_PUBLIC_CMS_READ_KEY!,
          },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) throw new Error("Submit failed");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return <p>✓ Thanks — we'll be in touch shortly.</p>;
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
      {schema.fields.map((f: any) => (
        <label key={f.key} style={{ display: "grid", gap: 4 }}>
          <span>{f.label}{f.required ? " *" : ""}</span>
          {f.type === "textarea" ? (
            <textarea name={f.key} required={f.required} rows={4} />
          ) : f.type === "select" ? (
            <select name={f.key} required={f.required}>
              <option value="">Select…</option>
              {f.options?.map((o: string) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
              name={f.key}
              required={f.required}
            />
          )}
        </label>
      ))}
      <input type="text" name="_hp" style={{ display: "none" }} tabIndex={-1} autoComplete="off" />
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Submit"}
      </button>
      {status === "error" && <p style={{ color: "red" }}>Error — try again.</p>}
    </form>
  );
}