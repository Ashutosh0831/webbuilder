import { getForm } from "@/lib/cms";
import { ContactForm } from "./ContactForm";

export const revalidate = 60;

export const metadata = { title: "Contact Us" };

export default async function ContactPage() {
  let form;
  try {
    form = await getForm("quote");
  } catch {
    form = { schema: { fields: [] }, key: "quote" };
  }
  return (
    <div>
      <h1>{form.name ?? "Request a Quote"}</h1>
      <ContactForm formKey={form.key} schema={form.schema} />
    </div>
  );
}