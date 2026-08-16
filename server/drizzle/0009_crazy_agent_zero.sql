ALTER TABLE `groups` ADD `end_date` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `student_invites` ADD `start_score` integer;--> statement-breakpoint
ALTER TABLE `student_invites` ADD `start_grade` integer;--> statement-breakpoint
ALTER TABLE `student_invites` ADD `goal_grade` integer;--> statement-breakpoint
ALTER TABLE `students` ADD `start_score` integer;--> statement-breakpoint
ALTER TABLE `students` ADD `start_grade` integer;--> statement-breakpoint
ALTER TABLE `students` ADD `goal_grade` integer;