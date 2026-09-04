CREATE TABLE "crm_settings" (
	"teacher_id" text PRIMARY KEY NOT NULL,
	"refund_basis" text DEFAULT 'SUBSCRIPTION' NOT NULL,
	"withhold_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"withhold_fixed" numeric(10, 2) DEFAULT '0' NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"lessons_used" integer NOT NULL,
	"used_cost" numeric(10, 2) NOT NULL,
	"paid_amount" numeric(10, 2) NOT NULL,
	"withheld" numeric(10, 2) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"basis" text NOT NULL,
	"note" text,
	"created_at" text NOT NULL,
	CONSTRAINT "refunds_subscription_id_unique" UNIQUE("subscription_id")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "terminated_at" text;--> statement-breakpoint
ALTER TABLE "crm_settings" ADD CONSTRAINT "crm_settings_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;