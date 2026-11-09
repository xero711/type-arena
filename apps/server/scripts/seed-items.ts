import { equipmentItems, itemRarities } from '@type-arena/game-data';
import { inArray, sql } from 'drizzle-orm';
import { db, pool } from '../src/database/client.js';
import { items } from '../src/database/schema.js';

if (!db) {
  throw new Error('DATABASE_URL がありません。apps/server/.env を設定してください。');
}

try {
  await db.insert(items).values(equipmentItems.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    description: item.description,
    type: item.type,
    rarity: item.rarity,
    attack: item.attack,
    defense: item.defense,
    enabled: true,
  }))).onConflictDoUpdate({
    target: items.code,
    set: {
      name: sql`excluded.name`,
      description: sql`excluded.description`,
      type: sql`excluded.type`,
      rarity: sql`excluded.rarity`,
      attack: sql`excluded.attack`,
      defense: sql`excluded.defense`,
      enabled: true,
    },
  });
  const retiredWeapons = itemRarities.flatMap((rarity) => [`weapon_${rarity}_spear`, `weapon_${rarity}_axe`]);
  await db.update(items).set({ enabled: false }).where(inArray(items.code, retiredWeapons));
  console.info(`装備アイテム ${equipmentItems.length} 件を登録しました。`);
} finally {
  await pool?.end();
}
