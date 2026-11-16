import type { CollectionAfterChangeHook } from 'payload'
import { revalidatePath } from 'next/cache'

export const revalidateService: CollectionAfterChangeHook = ({
  doc,
  previousDoc,
  req: { payload },
}) => {
  // Revalidate the service detail page
  if (doc?.slug) {
    const path = `/services/${doc.slug}`
    payload.logger.info(`Revalidating service at path: ${path}`)
    revalidatePath(path)
  }

  // Also revalidate the homepage (because the homepage lists all services)
  revalidatePath('/')

  // If the slug was modified, also revalidate the old path
  if (previousDoc?.slug && previousDoc.slug !== doc.slug) {
    revalidatePath(`/services/${previousDoc.slug}`)
  }

  return doc
}