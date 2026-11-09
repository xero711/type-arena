import { eq, inArray, sql } from 'drizzle-orm';
import type { db } from '../database/client.js';
import { coinLedger, matches, users } from '../database/schema.js';
import type { BattleOutcome } from './battle-manager.js';

export const MATCH_REWARD = { completion: 50, win: 30, accuracy: 10, accuracyThreshold: 95, combo: 10, comboThreshold: 10 } as const;

export function calculateRatingChanges(ratings: [number, number], winnerIndex: 0 | 1): [number, number] {
  const expectedOne = 1 / (1 + 10 ** ((ratings[1] - ratings[0]) / 400));
  const scoreOne = winnerIndex === 0 ? 1 : 0;
  const changeOne = Math.round(32 * (scoreOne - expectedOne));
  return [changeOne, -changeOne];
}

export type PersistedMatchResult = {
  ratingChanges: [number, number];
  coinRewards: [number, number];
  ratings: [number, number];
};

/** 勝敗、レート、ウォレット、監査台帳を一つのDBトランザクションで確定する。 */
export async function persistBattleOutcome(database: NonNullable<typeof db>, outcome: BattleOutcome): Promise<PersistedMatchResult> {
  return database.transaction(async (tx) => {
    const [existing] = await tx.select().from(matches).where(eq(matches.id, outcome.matchId)).limit(1);
    if (existing) {
      const [one] = await tx.select({ rating: users.rating }).from(users).where(eq(users.id, existing.playerOneId)).limit(1);
      const [two] = await tx.select({ rating: users.rating }).from(users).where(eq(users.id, existing.playerTwoId)).limit(1);
      return {
        ratingChanges: [existing.playerOneRatingChange, existing.playerTwoRatingChange],
        coinRewards: [existing.playerOneCoinReward, existing.playerTwoCoinReward],
        ratings: [one?.rating ?? 0, two?.rating ?? 0],
      };
    }

    const playerIds = outcome.players.map((player) => player.userId);
    const locked = await tx.select({ id: users.id, rating: users.rating }).from(users)
      .where(inArray(users.id, playerIds)).orderBy(users.id).for('update');
    if (locked.length !== 2) throw new Error('match-player-missing');
    const ratingById = new Map(locked.map((player) => [player.id, player.rating]));
    const p1 = outcome.players[0];
    const p2 = outcome.players[1];
    const ratings: [number, number] = [ratingById.get(p1.userId)!, ratingById.get(p2.userId)!];
    const winnerIndex: 0 | 1 = outcome.winnerUid === p1.firebaseUid ? 0 : 1;
    const ratingChanges = outcome.winnerUid ? calculateRatingChanges(ratings, winnerIndex) : [0, 0] as [number, number];
    const coinRewards: [number, number] = outcome.reason === 'disconnect'
      ? [0, 0]
      : [MATCH_REWARD.completion + (winnerIndex === 0 ? MATCH_REWARD.win : 0) + (p1.accuracy >= MATCH_REWARD.accuracyThreshold ? MATCH_REWARD.accuracy : 0) + (p1.maxCombo >= MATCH_REWARD.comboThreshold ? MATCH_REWARD.combo : 0),
        MATCH_REWARD.completion + (winnerIndex === 1 ? MATCH_REWARD.win : 0) + (p2.accuracy >= MATCH_REWARD.accuracyThreshold ? MATCH_REWARD.accuracy : 0) + (p2.maxCombo >= MATCH_REWARD.comboThreshold ? MATCH_REWARD.combo : 0)];

    for (const [index, player] of outcome.players.entries()) {
      const reward = coinRewards[index as 0 | 1];
      await tx.update(users).set({ rating: ratings[index as 0 | 1] + ratingChanges[index as 0 | 1], updatedAt: new Date(outcome.finishedAt) })
        .where(eq(users.id, player.userId));
      // コインは原子的な加算SQLにし、同じ参照IDの台帳行を二重登録させない。
      if (reward > 0) {
        await tx.update(users).set({ coins: sql`${users.coins} + ${reward}`, updatedAt: new Date(outcome.finishedAt) }).where(eq(users.id, player.userId));
        await tx.insert(coinLedger).values({ userId: player.userId, amount: reward, reason: 'match-reward', referenceId: outcome.matchId }).onConflictDoNothing();
      }
    }

    await tx.insert(matches).values({
      id: outcome.matchId,
      playerOneId: p1.userId,
      playerTwoId: p2.userId,
      winnerId: outcome.winnerUid === p1.firebaseUid ? p1.userId : outcome.winnerUid === p2.firebaseUid ? p2.userId : null,
      playerOneResult: outcome.winnerUid === p1.firebaseUid ? 'win' : outcome.winnerUid === p2.firebaseUid ? 'lose' : 'disconnect',
      playerOneWpm: p1.wpm,
      playerTwoWpm: p2.wpm,
      playerOneAccuracy: p1.accuracy,
      playerTwoAccuracy: p2.accuracy,
      playerOneCharacters: p1.characters,
      playerTwoCharacters: p2.characters,
      playerOneMistakes: p1.mistakes,
      playerTwoMistakes: p2.mistakes,
      playerOneMaxCombo: p1.maxCombo,
      playerTwoMaxCombo: p2.maxCombo,
      playerOneRatingChange: ratingChanges[0],
      playerTwoRatingChange: ratingChanges[1],
      playerOneCoinReward: coinRewards[0],
      playerTwoCoinReward: coinRewards[1],
      completedAt: new Date(outcome.finishedAt),
    });
    return { ratingChanges, coinRewards, ratings: [ratings[0] + ratingChanges[0], ratings[1] + ratingChanges[1]] };
  });
}
