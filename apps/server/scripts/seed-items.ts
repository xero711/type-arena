import { equipmentItems } from '@type-arena/game-data';
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
  }))).onConflictDoNothing({ target: items.code });
  console.info(`装備アイテム ${equipmentItems.length} 件を登録しました。`);
} finally {
  await pool?.end();
}
