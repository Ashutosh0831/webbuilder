import { getForm } from "@/lib/cms";
import { ContactForm } from "@/app/contact/ContactForm";

export default async function BookingFormBlock({ title, subtitle }: { title: string; subtitle?: string }) {
  const form = await getForm("quote").catch(() => null);
  return (
    <section className="cms-booking-card">
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
      {form ? (
        <ContactForm formKey={form.key} schema={form.schema} />
      ) : (
        <>
          <p>Book an inspection or request a callback from our team.</p>
          <a className="cms-booking-link" href="/contact">Go to the booking form</a>
        </>
      )}
    </section>
  );
}
