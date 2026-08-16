ALTER TABLE `lessons` ADD `planned_start` text;--> statement-breakpoint
ALTER TABLE `lessons` ADD `override_type` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
UPDATE `lessons` SET `planned_start` = `start_at` WHERE `planned_start` IS NULL;--> statement-breakpoint
UPDATE `lessons` SET `override_type` = 'extra' WHERE `series_id` IS NULL AND `status` != 'cancelled';--> statement-breakpoint
UPDATE `lessons` SET `override_type` = 'cancelled' WHERE `status` = 'cancelled';