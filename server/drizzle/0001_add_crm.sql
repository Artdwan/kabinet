CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"name" text NOT NULL,
	"who" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT '' NOT NULL,
	"phone" text,
	"from_lead_id" text,
	"created_at" text NOT NULL,
	CONSTRAINT "clients_from_lead_id_unique" UNIQUE("from_lead_id")
);
--> statement-breakpoint
CREATE TABLE "crm_students" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"grade" text DEFAULT '' NOT NULL,
	"user_id" text,
	"created_at" text NOT NULL,
	CONSTRAINT "crm_students_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"name" text NOT NULL,
	"who" text DEFAULT '' NOT NULL,
	"grade" text DEFAULT '' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'NEW' NOT NULL,
	"sub" text DEFAULT '' NOT NULL,
	"task" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"paid_at" text NOT NULL,
	"note" text,
	"receipt_name" text,
	"receipt_type" text,
	"receipt_data" "bytea",
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"subject" text NOT NULL,
	"period_start" text NOT NULL,
	"lessons_count" integer NOT NULL,
	"price_per_lesson" numeric(10, 2) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "subscriptions_student_id_subject_period_start_unique" UNIQUE("student_id","subject","period_start")
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"stage" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_from_lead_id_leads_id_fk" FOREIGN KEY ("from_lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_students" ADD CONSTRAINT "crm_students_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_students" ADD CONSTRAINT "crm_students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_student_id_crm_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."crm_students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;