CREATE TABLE `lesson_attendance` (
	`lesson_id` text NOT NULL,
	`student_id` text NOT NULL,
	`status` text NOT NULL,
	PRIMARY KEY(`lesson_id`, `student_id`),
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`group_id` text,
	`student_id` text,
	`title` text DEFAULT '' NOT NULL,
	`start_at` text NOT NULL,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`format` text DEFAULT 'offline' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`series_id` text,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
