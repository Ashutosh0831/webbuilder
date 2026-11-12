import { z } from "zod";
import type { ComponentDefinition } from "../types";

const schema = z.object({
  items: z.array(z.object({
    question: z.string().min(1).max(200),
    answer: z.string().min(1).max(2000),
  })).min(1).max(20),
});

type Props = z.infer<typeof schema>;

export const faqComponent: ComponentDefinition<Props> = {
  key: "faq",
  displayName: "FAQ",
  description: "Frequently asked questions with answers",
  category: "content",
  icon: "CircleHelp",
  propsSchema: schema,
  defaultProps: {
    items: [{ question: "How does it work?", answer: "Add your answer here." }],
  },
  allowedChildren: [],
  render: ({ props }) => (
    <dl className="space-y-4">
      {props.items.map((item, index) => (
        <div key={index} className="rounded-lg border p-4">
          <dt className="font-semibold">{item.question}</dt>
          <dd className="mt-2 text-sm text-muted-foreground">{item.answer}</dd>
        </div>
      ))}
    </dl>
  ),
  editorFields: [
    { key: "items", label: "Questions and answers (JSON)", control: { type: "json", rows: 10 }, group: "content" },
  ],
};