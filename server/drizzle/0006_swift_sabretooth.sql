CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`group_id` text,
	`title` text NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`url` text,
	`content` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `groups` ADD `direction` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `goal` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `schedule_note` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `start_date` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `color` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `max_students` integer;--> statement-breakpoint
ALTER TABLE `groups` ADD `hw_defaults` text;