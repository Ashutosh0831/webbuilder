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

    const apiUrl = process.env.NEXT_PUBLIC_CMS_API_URL;
    const siteSlug = process.env.NEXT_PUBLIC_CMS_SITE_SLUG;
    const apiKey = process.env.NEXT_PUBLIC_CMS_READ_KEY;
    if (!apiUrl || !siteSlug || !apiKey) {
      setStatus("error");
      return;
    }

    const fd = new FormData(e.currentTarget);
    const data: Record<string, string | boolean> = {};
    for (const field of schema.fields) {
      const value = fd.get(field.key);
      data[field.key] = field.type === "checkbox"
        ? value !== null
        : String(value ?? "");
    }
    data._hp = String(fd.get("_hp") ?? "");

    try {
      const res = await fetch(
        `${apiUrl.replace(/\/$/, "")}/api/v1/sites/${encodeURIComponent(siteSlug)}/forms/${encodeURIComponent(formKey)}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
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
    return <p role="status">✓ Thanks — we'll be in touch shortly.</p>;
  }

  return (
    <form className="contact-form" onSubmit={onSubmit}>
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
          ) : f.type === "checkbox" ? (
            <input type="checkbox" name={f.key} value="true" required={f.required} />
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
      {status === "error" && <p role="alert" style={{ color: "red" }}>Could not submit the form. Check the site configuration and try again.</p>}
    </form>
  );
}

