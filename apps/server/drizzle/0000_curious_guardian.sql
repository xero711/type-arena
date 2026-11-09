CREATE TYPE "public"."item_type" AS ENUM('weapon', 'armor', 'accessory');--> statement-breakpoint
CREATE TYPE "public"."match_result" AS ENUM('win', 'lose', 'draw', 'disconnect');--> statement-breakpoint
CREATE TYPE "public"."item_rarity" AS ENUM('common', 'rare', 'epic', 'legendary');--> statement-breakpoint
CREATE TABLE "coin_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"reference_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"user_id" text NOT NULL,
	"slot" "item_type" NOT NULL,
	"item_id" text NOT NULL,
	"equipped_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_user_id_slot_pk" PRIMARY KEY("user_id","slot")
);
--> statement-breakpoint
CREATE TABLE "gacha_pulls" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"cost" integer NOT NULL,
	"pulled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" "item_type" NOT NULL,
	"rarity" "item_rarity" NOT NULL,
	"attack" integer DEFAULT 0 NOT NULL,
	"defense" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "items_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"player_one_id" text NOT NULL,
	"player_two_id" text NOT NULL,
	"winner_id" text,
	"player_one_result" "match_result" NOT NULL,
	"player_one_wpm" integer NOT NULL,
	"player_two_wpm" integer NOT NULL,
	"player_one_accuracy" integer NOT NULL,
	"player_two_accuracy" integer NOT NULL,
	"player_one_characters" integer DEFAULT 0 NOT NULL,
	"player_two_characters" integer DEFAULT 0 NOT NULL,
	"player_one_mistakes" integer DEFAULT 0 NOT NULL,
	"player_two_mistakes" integer DEFAULT 0 NOT NULL,
	"player_one_max_combo" integer DEFAULT 0 NOT NULL,
	"player_two_max_combo" integer DEFAULT 0 NOT NULL,
	"player_one_rating_change" integer NOT NULL,
	"player_two_rating_change" integer NOT NULL,
	"player_one_coin_reward" integer NOT NULL,
	"player_two_coin_reward" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"firebase_uid" text NOT NULL,
	"display_name" text NOT NULL,
	"photo_url" text,
	"rating" integer DEFAULT 1200 NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid")
);
--> statement-breakpoint
ALTER TABLE "coin_ledger" ADD CONSTRAINT "coin_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gacha_pulls" ADD CONSTRAINT "gacha_pulls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gacha_pulls" ADD CONSTRAINT "gacha_pulls_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player_one_id_users_id_fk" FOREIGN KEY ("player_one_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player_two_id_users_id_fk" FOREIGN KEY ("player_two_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coin_ledger_reason_reference_unique" ON "coin_ledger" USING btree ("user_id","reason","reference_id");--> statement-breakpoint
CREATE INDEX "coin_ledger_user_created_idx" ON "coin_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "gacha_pulls_user_pulled_idx" ON "gacha_pulls" USING btree ("user_id","pulled_at");--> statement-breakpoint
CREATE INDEX "matches_player_one_completed_idx" ON "matches" USING btree ("player_one_id","completed_at");--> statement-breakpoint
CREATE INDEX "matches_player_two_completed_idx" ON "matches" USING btree ("player_two_id","completed_at");
