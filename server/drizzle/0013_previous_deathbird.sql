ALTER TABLE `student_invites` ADD `group_ids` text;--> statement-breakpoint
ALTER TABLE `student_invites` ADD `schedule_subject_id` text;--> statement-breakpoint
ALTER TABLE `student_invites` ADD `schedule_slots` text;--> statement-breakpoint
ALTER TABLE `student_invites` ADD `schedule_start_date` text;--> statement-breakpoint
ALTER TABLE `student_invites` ADD `schedule_end_date` text;--> statement-breakpoint
ALTER TABLE `student_invites` ADD `schedule_format` text DEFAULT 'offline' NOT NULL;--> statement-breakpoint
ALTER TABLE `student_invites` ADD `schedule_location` text;