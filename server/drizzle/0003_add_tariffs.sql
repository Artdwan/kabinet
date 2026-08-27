CREATE TABLE "tariffs" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"name" text NOT NULL,
	"subject" text,
	"grade_from" integer,
	"grade_to" integer,
	"applies_to" text DEFAULT 'ANY' NOT NULL,
	"mode" text DEFAULT 'PER_LESSON' NOT NULL,
	"price_per_lesson" numeric(10, 2),
	"monthly_price" numeric(10, 2),
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"lessons_per_month" integer,
	"active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "monthly_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;