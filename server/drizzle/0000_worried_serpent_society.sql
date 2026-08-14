CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`homework_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`type` text NOT NULL,
	`kind` text NOT NULL,
	`file_path` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ct_results` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`test_id` text NOT NULL,
	`title` text NOT NULL,
	`subject_id` text NOT NULL,
	`date` text NOT NULL,
	`score` integer NOT NULL,
	`minutes` integer NOT NULL,
	`topic_accuracy` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ct_sessions` (
	`student_id` text NOT NULL,
	`test_id` text NOT NULL,
	`started_at` text NOT NULL,
	`answers` text NOT NULL,
	`flagged` text NOT NULL,
	`current` integer DEFAULT 0 NOT NULL,
	`elapsed` integer DEFAULT 0 NOT NULL,
	`finished_at` text,
	`only` text,
	PRIMARY KEY(`student_id`, `test_id`),
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ct_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`topic_id` text,
	`title` text NOT NULL,
	`format` text NOT NULL,
	`difficulty` text NOT NULL,
	`minutes` integer NOT NULL,
	`description` text NOT NULL,
	`questions` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_records` (
	`student_id` text NOT NULL,
	`trainer_id` text NOT NULL,
	`best` integer DEFAULT 0 NOT NULL,
	`played` integer DEFAULT 0 NOT NULL,
	`last_score` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`student_id`, `trainer_id`),
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `group_members` (
	`group_id` text NOT NULL,
	`student_user_id` text NOT NULL,
	PRIMARY KEY(`group_id`, `student_user_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`teacher_id` text NOT NULL,
	`subject_id` text NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `homework_attempts` (
	`student_id` text NOT NULL,
	`homework_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`value` text DEFAULT '""' NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`hints_opened` integer DEFAULT 0 NOT NULL,
	`solution_opened` integer DEFAULT false NOT NULL,
	`draft_text` text DEFAULT '' NOT NULL,
	`drawing` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`student_id`, `homework_id`, `exercise_id`),
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`homework_id`) REFERENCES `homeworks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `homework_state` (
	`student_id` text NOT NULL,
	`homework_id` text NOT NULL,
	`started_at` text,
	`submitted_at` text,
	`reviewed_at` text,
	PRIMARY KEY(`student_id`, `homework_id`),
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`homework_id`) REFERENCES `homeworks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `homeworks` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`assigned_at` text NOT NULL,
	`due_at` text NOT NULL,
	`allow_instant_check` integer DEFAULT true NOT NULL,
	`sections` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`text` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`homework_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `parent_links` (
	`parent_user_id` text NOT NULL,
	`student_user_id` text NOT NULL,
	PRIMARY KEY(`parent_user_id`, `student_user_id`),
	FOREIGN KEY (`parent_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `review_cards` (
	`student_id` text NOT NULL,
	`card_id` text NOT NULL,
	`box` integer DEFAULT 1 NOT NULL,
	`due` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`student_id`, `card_id`),
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`instant_check` integer DEFAULT true NOT NULL,
	`reduce_motion` integer DEFAULT false NOT NULL,
	`compact_cards` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `students` (
	`user_id` text PRIMARY KEY NOT NULL,
	`grade` integer DEFAULT 11 NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`goal_score` integer DEFAULT 85 NOT NULL,
	`teacher_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teacher_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`homework_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	`grade` text NOT NULL,
	`text` text NOT NULL,
	`flagged` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `technique_progress` (
	`student_id` text NOT NULL,
	`technique_id` text NOT NULL,
	`practiced` integer DEFAULT 0 NOT NULL,
	`done` text DEFAULT '[]' NOT NULL,
	`last_at` text,
	PRIMARY KEY(`student_id`, `technique_id`),
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `techniques` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subtitle` text NOT NULL,
	`minutes` integer NOT NULL,
	`trainer_id` text,
	`summary` text NOT NULL,
	`steps` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `theory_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`minutes` integer NOT NULL,
	`is_new` integer DEFAULT false NOT NULL,
	`blocks` text NOT NULL,
	`related_homework_ids` text NOT NULL,
	`quiz` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `theory_progress` (
	`student_id` text NOT NULL,
	`material_id` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`last_block` integer DEFAULT 0 NOT NULL,
	`quiz` text DEFAULT '{}' NOT NULL,
	PRIMARY KEY(`student_id`, `material_id`),
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trainers` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`subtitle` text NOT NULL,
	`description` text NOT NULL,
	`technique_id` text,
	`seconds` integer,
	`lives` integer,
	`rounds` text,
	`items` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`extra` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);