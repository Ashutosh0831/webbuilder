import type { CollectionConfig } from 'payload'

export const Locations: CollectionConfig = {
  slug: 'locations',
  admin: { useAsTitle: 'name' },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'name', type: 'text', required: true },
    { name: 'state', type: 'text' },
    { name: 'metaTitle', type: 'text' },
    { name: 'metaDescription', type: 'textarea' },
    { name: 'headline', type: 'text' },
    { name: 'intro', type: 'textarea' },
    { name: 'localContext', type: 'array', fields: [{ name: 'text', type: 'text' }] },
    { name: 'neighbourhoods', type: 'array', fields: [{ name: 'text', type: 'text' }] },
    { name: 'responseTime', type: 'text' },
    {
      name: 'faqs',
      type: 'array',
      fields: [
        { name: 'q', type: 'text' },
        { name: 'a', type: 'textarea' },
      ],
    },
  ],
}