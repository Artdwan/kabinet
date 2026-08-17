CREATE TABLE `group_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`student_user_id` text NOT NULL,
	`joined_at` text NOT NULL,
	`left_at` text,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `group_memberships` (`id`, `group_id`, `student_user_id`, `joined_at`, `left_at`)
SELECT
  lower(hex(randomblob(16))),
  gm.group_id,
  gm.student_user_id,
  COALESCE((SELECT g.start_date FROM `groups` g WHERE g.id = gm.group_id), date('now')),
  NULL
FROM `group_members` gm;
