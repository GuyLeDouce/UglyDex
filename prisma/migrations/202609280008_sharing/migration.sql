-- CreateEnum
CREATE TYPE "CollectionVisibility" AS ENUM ('FULL', 'FEATURED_ONLY', 'HIDDEN');

-- CreateEnum
CREATE TYPE "GalleryVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "GalleryMode" AS ENUM ('CURRENT_COLLECTION', 'DISCOVERED_HISTORY');

-- CreateEnum
CREATE TYPE "GalleryLayout" AS ENUM ('GRID', 'EXHIBITION', 'COMPACT');

-- AlterTable
ALTER TABLE "Collector" ADD COLUMN     "collectionVisibility" "CollectionVisibility" NOT NULL DEFAULT 'FULL';

-- CreateTable
CREATE TABLE "CollectorGallery" (
    "id" UUID NOT NULL,
    "collectorId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "visibility" "GalleryVisibility" NOT NULL DEFAULT 'PRIVATE',
    "mode" "GalleryMode" NOT NULL DEFAULT 'CURRENT_COLLECTION',
    "layout" "GalleryLayout" NOT NULL DEFAULT 'GRID',
    "coverTokenId" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectorGallery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectorGalleryItem" (
    "galleryId" UUID NOT NULL,
    "squigId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "section" TEXT NOT NULL DEFAULT '',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectorGalleryItem_pkey" PRIMARY KEY ("galleryId","squigId")
);

-- CreateTable
CREATE TABLE "ShareRenderMetric" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "artworkFailures" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareRenderMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectorGallery_collectorId_visibility_featured_idx" ON "CollectorGallery"("collectorId", "visibility", "featured");

-- CreateIndex
CREATE UNIQUE INDEX "CollectorGallery_collectorId_slug_key" ON "CollectorGallery"("collectorId", "slug");

-- CreateIndex
CREATE INDEX "CollectorGalleryItem_galleryId_sortOrder_idx" ON "CollectorGalleryItem"("galleryId", "sortOrder");

-- CreateIndex
CREATE INDEX "ShareRenderMetric_createdAt_idx" ON "ShareRenderMetric"("createdAt");

-- AddForeignKey
ALTER TABLE "CollectorGallery" ADD CONSTRAINT "CollectorGallery_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorGalleryItem" ADD CONSTRAINT "CollectorGalleryItem_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "CollectorGallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorGalleryItem" ADD CONSTRAINT "CollectorGalleryItem_squigId_fkey" FOREIGN KEY ("squigId") REFERENCES "Squig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CollectorGallery" ADD CONSTRAINT "gallery_slug_normalized" CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 48);
CREATE UNIQUE INDEX "gallery_one_featured" ON "CollectorGallery" ("collectorId") WHERE featured;
ALTER TABLE "CollectorGalleryItem" ADD CONSTRAINT "gallery_item_bounds" CHECK ("sortOrder" BETWEEN 0 AND 99 AND length(caption)<=180 AND length(section)<=40);
