CREATE TABLE "ad_spend" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"spent_on" text NOT NULL,
	"channel" text DEFAULT '' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'BYN' NOT NULL,
	"rate" numeric(10, 4) DEFAULT '1' NOT NULL,
	"note" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_spend" ADD CONSTRAINT "ad_spend_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;