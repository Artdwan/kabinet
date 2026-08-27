CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"homework_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"name" text NOT NULL,
	"size" integer NOT NULL,
	"type" text NOT NULL,
	"kind" text NOT NULL,
	"file_path" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ct_results" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"test_id" text NOT NULL,
	"title" text NOT NULL,
	"subject_id" text NOT NULL,
	"date" text NOT NULL,
	"score" integer NOT NULL,
	"minutes" integer NOT NULL,
	"topic_accuracy" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ct_sessions" (
	"student_id" text NOT NULL,
	"test_id" text NOT NULL,
	"started_at" text NOT NULL,
	"answers" jsonb NOT NULL,
	"flagged" jsonb NOT NULL,
	"current" integer DEFAULT 0 NOT NULL,
	"elapsed" integer DEFAULT 0 NOT NULL,
	"finished_at" text,
	"only" jsonb,
	CONSTRAINT "ct_sessions_student_id_test_id_pk" PRIMARY KEY("student_id","test_id")
);
--> statement-breakpoint
CREATE TABLE "ct_tests" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"topic_id" text,
	"title" text NOT NULL,
	"format" text NOT NULL,
	"difficulty" text NOT NULL,
	"minutes" integer NOT NULL,
	"description" text NOT NULL,
	"questions" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_records" (
	"student_id" text NOT NULL,
	"trainer_id" text NOT NULL,
	"best" integer DEFAULT 0 NOT NULL,
	"played" integer DEFAULT 0 NOT NULL,
	"last_score" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "game_records_student_id_trainer_id_pk" PRIMARY KEY("student_id","trainer_id")
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" text NOT NULL,
	"student_user_id" text NOT NULL,
	CONSTRAINT "group_members_group_id_student_user_id_pk" PRIMARY KEY("group_id","student_user_id")
);
--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"student_user_id" text NOT NULL,
	"joined_at" text NOT NULL,
	"left_at" text
);
--> statement-breakpoint
CREATE TABLE "group_pauses" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"reason" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"teacher_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"grade" integer,
	"description" text,
	"direction" text,
	"goal" text,
	"schedule_note" text,
	"schedule_days" jsonb,
	"schedule_time" text,
	"schedule_slots" jsonb,
	"schedule_format" text DEFAULT 'offline' NOT NULL,
	"schedule_location" text,
	"start_date" text,
	"end_date" text,
	"active" boolean DEFAULT true NOT NULL,
	"color" text,
	"max_students" integer,
	"hw_defaults" jsonb
);
--> statement-breakpoint
CREATE TABLE "homework_attempts" (
	"student_id" text NOT NULL,
	"homework_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"value" jsonb DEFAULT '""' NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"hints_opened" integer DEFAULT 0 NOT NULL,
	"solution_opened" boolean DEFAULT false NOT NULL,
	"draft_text" text DEFAULT '' NOT NULL,
	"drawing" text,
	"updated_at" text NOT NULL,
	CONSTRAINT "homework_attempts_student_id_homework_id_exercise_id_pk" PRIMARY KEY("student_id","homework_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE "homework_state" (
	"student_id" text NOT NULL,
	"homework_id" text NOT NULL,
	"started_at" text,
	"submitted_at" text,
	"reviewed_at" text,
	CONSTRAINT "homework_state_student_id_homework_id_pk" PRIMARY KEY("student_id","homework_id")
);
--> statement-breakpoint
CREATE TABLE "homeworks" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"assigned_at" text NOT NULL,
	"due_at" text NOT NULL,
	"allow_instant_check" boolean DEFAULT true NOT NULL,
	"sections" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_attendance" (
	"lesson_id" text NOT NULL,
	"student_id" text NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "lesson_attendance_lesson_id_student_id_pk" PRIMARY KEY("lesson_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "lesson_participant_overrides" (
	"lesson_id" text NOT NULL,
	"student_id" text NOT NULL,
	"action" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "lesson_participant_overrides_lesson_id_student_id_pk" PRIMARY KEY("lesson_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"group_id" text,
	"student_id" text,
	"title" text DEFAULT '' NOT NULL,
	"start_at" text NOT NULL,
	"planned_start" text,
	"override_type" text DEFAULT 'none' NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"format" text DEFAULT 'offline' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"cancel_reason" text,
	"series_id" text,
	"note" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"group_id" text,
	"title" text NOT NULL,
	"type" text DEFAULT 'other' NOT NULL,
	"url" text,
	"content" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"date" text NOT NULL,
	"kind" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"homework_id" text
);
--> statement-breakpoint
CREATE TABLE "parent_links" (
	"parent_user_id" text NOT NULL,
	"student_user_id" text NOT NULL,
	CONSTRAINT "parent_links_parent_user_id_student_user_id_pk" PRIMARY KEY("parent_user_id","student_user_id")
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_card_defs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"topic_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_cards" (
	"student_id" text NOT NULL,
	"card_id" text NOT NULL,
	"box" integer DEFAULT 1 NOT NULL,
	"due" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "review_cards_student_id_card_id_pk" PRIMARY KEY("student_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"instant_check" boolean DEFAULT true NOT NULL,
	"reduce_motion" boolean DEFAULT false NOT NULL,
	"compact_cards" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_freezes" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"student_id" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"reason" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_invites" (
	"token" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"group_id" text,
	"group_ids" jsonb,
	"name" text NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"grade" integer,
	"goal_score" integer,
	"start_score" integer,
	"start_grade" integer,
	"goal_grade" integer,
	"note" text,
	"schedule_subject_id" text,
	"schedule_slots" jsonb,
	"schedule_start_date" text,
	"schedule_end_date" text,
	"schedule_format" text DEFAULT 'offline' NOT NULL,
	"schedule_location" text,
	"created_at" text NOT NULL,
	"accepted_user_id" text,
	"accepted_at" text
);
--> statement-breakpoint
CREATE TABLE "students" (
	"user_id" text PRIMARY KEY NOT NULL,
	"grade" integer DEFAULT 11 NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"goal_score" integer DEFAULT 85 NOT NULL,
	"start_score" integer,
	"start_grade" integer,
	"goal_grade" integer,
	"teacher_id" text,
	"note" text,
	"schedule_subject_id" text,
	"schedule_slots" jsonb,
	"schedule_start_date" text,
	"schedule_end_date" text,
	"schedule_active" boolean DEFAULT true NOT NULL,
	"schedule_format" text DEFAULT 'offline' NOT NULL,
	"schedule_location" text
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"homework_id" text NOT NULL,
	"teacher_id" text NOT NULL,
	"grade" text NOT NULL,
	"text" text NOT NULL,
	"flagged" jsonb NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technique_progress" (
	"student_id" text NOT NULL,
	"technique_id" text NOT NULL,
	"practiced" integer DEFAULT 0 NOT NULL,
	"done" jsonb DEFAULT '[]' NOT NULL,
	"last_at" text,
	CONSTRAINT "technique_progress_student_id_technique_id_pk" PRIMARY KEY("student_id","technique_id")
);
--> statement-breakpoint
CREATE TABLE "techniques" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text NOT NULL,
	"minutes" integer NOT NULL,
	"trainer_id" text,
	"summary" text NOT NULL,
	"steps" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theory_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"minutes" integer NOT NULL,
	"is_new" boolean DEFAULT false NOT NULL,
	"blocks" jsonb NOT NULL,
	"related_homework_ids" jsonb NOT NULL,
	"quiz" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theory_progress" (
	"student_id" text NOT NULL,
	"material_id" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"last_block" integer DEFAULT 0 NOT NULL,
	"quiz" jsonb DEFAULT '{}' NOT NULL,
	CONSTRAINT "theory_progress_student_id_material_id_pk" PRIMARY KEY("student_id","material_id")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trainers" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"subtitle" text NOT NULL,
	"description" text NOT NULL,
	"technique_id" text,
	"seconds" integer,
	"lives" integer,
	"rounds" jsonb,
	"items" jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"extra" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ct_results" ADD CONSTRAINT "ct_results_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ct_sessions" ADD CONSTRAINT "ct_sessions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_records" ADD CONSTRAINT "game_records_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_student_user_id_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_student_user_id_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_pauses" ADD CONSTRAINT "group_pauses_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_attempts" ADD CONSTRAINT "homework_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_attempts" ADD CONSTRAINT "homework_attempts_homework_id_homeworks_id_fk" FOREIGN KEY ("homework_id") REFERENCES "public"."homeworks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_state" ADD CONSTRAINT "homework_state_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_state" ADD CONSTRAINT "homework_state_homework_id_homeworks_id_fk" FOREIGN KEY ("homework_id") REFERENCES "public"."homeworks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_attendance" ADD CONSTRAINT "lesson_attendance_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_attendance" ADD CONSTRAINT "lesson_attendance_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_participant_overrides" ADD CONSTRAINT "lesson_participant_overrides_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_participant_overrides" ADD CONSTRAINT "lesson_participant_overrides_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_links" ADD CONSTRAINT "parent_links_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_links" ADD CONSTRAINT "parent_links_student_user_id_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_freezes" ADD CONSTRAINT "student_freezes_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_freezes" ADD CONSTRAINT "student_freezes_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_invites" ADD CONSTRAINT "student_invites_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_invites" ADD CONSTRAINT "student_invites_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_invites" ADD CONSTRAINT "student_invites_accepted_user_id_users_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_feedback" ADD CONSTRAINT "teacher_feedback_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_feedback" ADD CONSTRAINT "teacher_feedback_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technique_progress" ADD CONSTRAINT "technique_progress_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theory_progress" ADD CONSTRAINT "theory_progress_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;