-- AlterTable: gallery kind + title for popup lightbox (image/video)
ALTER TABLE `gallery_items` ADD COLUMN `kind` VARCHAR(20) NOT NULL DEFAULT 'image',
ADD COLUMN `title` VARCHAR(300) NULL;
