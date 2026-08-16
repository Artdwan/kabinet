ALTER TABLE `students` ADD `schedule_subject_id` text;--> statement-breakpoint
ALTER TABLE `students` ADD `schedule_slots` text;--> statement-breakpoint
ALTER TABLE `students` ADD `schedule_start_date` text;--> statement-breakpoint
ALTER TABLE `students` ADD `schedule_end_date` text;--> statement-breakpoint
ALTER TABLE `students` ADD `schedule_active` integer DEFAULT true NOT NULL;