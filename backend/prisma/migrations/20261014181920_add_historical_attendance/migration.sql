-- CreateTable
CREATE TABLE `historical_attendance` (
    `id` VARCHAR(191) NOT NULL,
    `semesterId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `present` INTEGER NOT NULL,
    `total` INTEGER NOT NULL,
    `batchId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `historical_attendance_subjectId_key`(`subjectId`),
    INDEX `historical_attendance_semesterId_idx`(`semesterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `historical_attendance` ADD CONSTRAINT `historical_attendance_semesterId_fkey` FOREIGN KEY (`semesterId`) REFERENCES `semesters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historical_attendance` ADD CONSTRAINT `historical_attendance_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
