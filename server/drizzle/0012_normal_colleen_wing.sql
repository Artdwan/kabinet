ALTER TABLE `groups` ADD `schedule_format` text DEFAULT 'offline' NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` ADD `schedule_location` text;--> statement-breakpoint
ALTER TABLE `students` ADD `schedule_format` text DEFAULT 'offline' NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `schedule_location` text;