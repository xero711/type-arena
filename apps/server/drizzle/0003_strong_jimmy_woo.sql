CREATE TABLE "gacha_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"count" integer NOT NULL,
	"response" jsonb,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gacha_requests" ADD CONSTRAINT "gacha_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gacha_requests_user_key_unique" ON "gacha_requests" USING btree ("user_id","idempotency_key");