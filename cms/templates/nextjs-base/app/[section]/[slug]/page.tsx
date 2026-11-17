import { notFound } from "next/navigation";
import { getPageBySlug } from "@/lib/cms";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { section: string; slug: string } }) {
  try {
    const page = await getPageBySlug(params.section, params.slug);
    return { title: page.title, description: page.seo_description || "" };
  } catch {
    return { title: "Not Found" };
  }
}

export default async function DynamicPage({ params }: { params: { section: string; slug: string } }) {
  let pageData;
  try {
    pageData = await getPageBySlug(params.section, params.slug);
  } catch {
    notFound();
  }

  const sections = pageData.parsed_sections || [];

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      {sections.map((sec: any, i: number) => {
        
        if (sec.type === "hero") {
          return (
            <section key={i} className="mb-12">
              <h1 className="text-5xl font-bold mb-4">{sec.data.h1}</h1>
              <p className="text-xl text-gray-600">{sec.data.subheadline}</p>
            </section>
          );
        }

        if (sec.type === "faqs") {
          return (
            <section key={i} className="mb-12">
              <h2 className="text-3xl font-bold mb-6">{sec.data.title}</h2>
              <div className="space-y-4">
                {sec.data.items.map((item: any, idx: number) => (
                  <details key={idx} className="bg-gray-50 p-4 rounded-lg">
                    <summary className="font-semibold cursor-pointer">{item.question}</summary>
                    <p className="mt-2 text-gray-700">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          );
        }

        if (sec.type === "locations") {
          return (
            <section key={i} className="mb-12">
              <h2 className="text-3xl font-bold mb-6">{sec.data.title}</h2>
              <ul className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {sec.data.areas.map((area: string, idx: number) => (
                  <li key={idx} className="bg-gray-100 p-3 rounded text-center font-medium">
                    {area}
                  </li>
                ))}
              </ul>
            </section>
          );
        }

        if (sec.type === "text") {
          return (
            <section key={i} className="mb-8">
              <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                {sec.data.content}
              </div>
            </section>
          );
        }

        return null;
      })}
    </div>
  );
}