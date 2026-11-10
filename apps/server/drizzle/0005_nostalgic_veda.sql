ALTER TABLE "users" ALTER COLUMN "rating" SET DEFAULT 500;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "placement_matches" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Preserve each existing account's rating movement from the old 1200 starting point.
UPDATE "users" AS u
SET "rating" = GREATEST(0, u."rating" - 700),
    "placement_matches" = LEAST(5, (SELECT count(*) FROM "matches" AS m
      WHERE m."mode" = 'ranked' AND (m."player_one_id" = u."id" OR m."player_two_id" = u."id"))::integer);
