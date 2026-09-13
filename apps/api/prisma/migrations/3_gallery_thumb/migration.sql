-- AlterTable: gallery custom thumbnail (manual upload for Instagram items)
ALTER TABLE `gallery_items` ADD COLUMN `thumb` VARCHAR(2000) NULL;
