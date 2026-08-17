CREATE TABLE `group_pauses` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `lessons` ADD `cancel_reason` text;