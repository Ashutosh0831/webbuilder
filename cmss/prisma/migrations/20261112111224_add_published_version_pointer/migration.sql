-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "publishedVersionId" UUID;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "PageVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
