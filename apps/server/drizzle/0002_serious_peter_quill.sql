CREATE TYPE "public"."match_mode" AS ENUM('ranked', 'private');--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "mode" "match_mode" DEFAULT 'ranked' NOT NULL;