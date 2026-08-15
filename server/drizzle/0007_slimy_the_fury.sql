CREATE TABLE `student_invites` (
	`token` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`group_id` text,
	`name` text NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`grade` integer,
	`goal_score` integer,
	`note` text,
	`created_at` text NOT NULL,
	`accepted_user_id` text,
	`accepted_at` text,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accepted_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
