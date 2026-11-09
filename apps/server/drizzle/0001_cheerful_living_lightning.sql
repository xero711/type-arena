ALTER TYPE "public"."item_rarity" RENAME VALUE 'common' TO 'normal';--> statement-breakpoint
ALTER TYPE "public"."item_rarity" RENAME VALUE 'epic' TO 'super_rare';--> statement-breakpoint
ALTER TYPE "public"."item_rarity" RENAME VALUE 'legendary' TO 'hyper_rare';--> statement-breakpoint
ALTER TYPE "public"."item_rarity" ADD VALUE 'ultimate_rare';
