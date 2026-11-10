import { characterDamage, promptsForCharacter, shuffled, type CharacterId, type Prompt } from '@type-arena/game-data';
import type { QueueEntry } from '../matchmaking/matchmaker.js';

export type BattlePlayer = Pick<QueueEntry, 'firebaseUid' | 'userId' | 'socketId' | 'displayName' | 'rating' | 'character'>;
export type BattlePlayerResult = { firebaseUid: string; userId: string; rating: number; wpm: number; accuracy: number; characters: number; mistakes: number; maxCombo: number };
export type BattleOutcome = { matchId: string; winnerUid: string | null; loserUid: string | null; reason: 'knockout' | 'disconnect' | 'timeout'; finishedAt: number; players: [BattlePlayerResult, BattlePlayerResult] };
export type BattleSubmitResult =
  | { ok: false; code: 'battle-not-started' | 'battle-finished' | 'not-a-player' | 'wrong-prompt' | 'incomplete-input' | 'too-fast' }
  | { ok: true; damage: number; snapshots: [BattleSnapshot, BattleSnapshot]; outcome: BattleOutcome | null };
export type BattleKeyResult =
  | { ok: false; code: 'battle-not-started' | 'battle-finished' | 'not-a-player' | 'wrong-prompt' | 'invalid-key' | 'key-rate-limited' }
  | { ok: true; typed: string; mistakes: number; accuracy: number; combo: number; maxCombo: number };

export type BattleSnapshot = {
  matchId: string;
  opponent: { displayName: string; rating: number; character: CharacterId };
  character: CharacterId;
  ownHp: number;
  opponentHp: number;
  prompt: Pick<Prompt, 'id' | 'text' | 'reading' | 'category'>;
  completedPrompts: number;
  typed: string;
  accuracy: number;
  mistakes: number;
  maxCombo: number;
  startsAt: number;
  endsAt: number;
};

type PlayerState = { player: BattlePlayer; promptOrder: Prompt[]; hp: number; promptIndex: number; promptStartedAt: number; lastKeyAt: number; totalCharacters: number; completedPrompts: number; currentInput: string; correctKeystrokes: number; mistakes: number; currentCombo: number; maxCombo: number };
type Battle = { matchId: string; players: [PlayerState, PlayerState]; startsAt: number; endsAt: number; outcome: BattleOutcome | null };

/** サーバーがプロンプト順、入力検証、HP、攻撃力、勝敗を保持する。 */
export class BattleManager {
  private readonly battles = new Map<string, Battle>();
  private readonly uidToMatch = new Map<string, string>();

  create(matchId: string, players: [BattlePlayer, BattlePlayer], now = Date.now(), countdownMs = 3000, durationMs = 90_000): void {
    if (this.battles.has(matchId) || players[0].firebaseUid === players[1].firebaseUid) throw new Error('invalid-match');
    const initialSeed = [...matchId].reduce((sum, char) => Math.imul(sum ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
    const promptOrderFor = (player: BattlePlayer) => {
      let seed = initialSeed;
      return shuffled(promptsForCharacter(player.character ?? 'balanced'), () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      });
    };
    const state: Battle = {
      matchId,
      startsAt: now + countdownMs,
      endsAt: now + countdownMs + durationMs,
      outcome: null,
      players: players.map((player) => ({ player, promptOrder: promptOrderFor(player), hp: 100, promptIndex: 0, promptStartedAt: now + countdownMs, lastKeyAt: now + countdownMs - 20, totalCharacters: 0, completedPrompts: 0, currentInput: '', correctKeystrokes: 0, mistakes: 0, currentCombo: 0, maxCombo: 0 })) as [PlayerState, PlayerState],
    };
    this.battles.set(matchId, state);
    this.uidToMatch.set(players[0].firebaseUid, matchId);
    this.uidToMatch.set(players[1].firebaseUid, matchId);
  }

  snapshot(matchId: string, firebaseUid: string): BattleSnapshot | null {
    const battle = this.battles.get(matchId);
    if (!battle || battle.outcome) return null;
    const ownIndex = battle.players.findIndex((entry) => entry.player.firebaseUid === firebaseUid);
    if (ownIndex < 0) return null;
    return this.makeSnapshot(battle, ownIndex as 0 | 1);
  }

  typeKey(matchId: string, firebaseUid: string, promptId: string, rawKey: string, now = Date.now()): BattleKeyResult {
    const battle = this.battles.get(matchId);
    if (!battle || battle.outcome) return { ok: false, code: 'battle-finished' };
    if (now < battle.startsAt) return { ok: false, code: 'battle-not-started' };
    if (now >= battle.endsAt) return { ok: false, code: 'battle-finished' };
    const player = battle.players.find((entry) => entry.player.firebaseUid === firebaseUid);
    if (!player) return { ok: false, code: 'not-a-player' };
    const prompt = this.promptFor(player);
    if (prompt.id !== promptId) return { ok: false, code: 'wrong-prompt' };
    if (rawKey === 'Backspace') {
      if (now - player.lastKeyAt < 20) return { ok: false, code: 'key-rate-limited' };
      player.lastKeyAt = now;
      player.currentInput = player.currentInput.slice(0, -1);
      return { ok: true, typed: player.currentInput, mistakes: player.mistakes, accuracy: this.accuracy(player), combo: player.currentCombo, maxCombo: player.maxCombo };
    }
    const key = rawKey.toLowerCase();
    if (!/^[a-z]$/.test(key)) return { ok: false, code: 'invalid-key' };
    if (now - player.lastKeyAt < 20) return { ok: false, code: 'key-rate-limited' };
    player.lastKeyAt = now;
    const candidate = player.currentInput + key;
    if (!prompt.romaji.some((variant) => variant.startsWith(candidate))) {
      player.mistakes += 1;
      player.currentCombo = 0;
      return { ok: true, typed: player.currentInput, mistakes: player.mistakes, accuracy: this.accuracy(player), combo: player.currentCombo, maxCombo: player.maxCombo };
    }
    player.currentInput = candidate;
    player.correctKeystrokes += 1;
    player.currentCombo += 1;
    player.maxCombo = Math.max(player.maxCombo, player.currentCombo);
    return { ok: true, typed: candidate, mistakes: player.mistakes, accuracy: this.accuracy(player), combo: player.currentCombo, maxCombo: player.maxCombo };
  }

  submit(matchId: string, firebaseUid: string, promptId: string, now = Date.now()): BattleSubmitResult {
    const battle = this.battles.get(matchId);
    if (!battle) return { ok: false, code: 'battle-finished' };
    if (battle.outcome) return { ok: false, code: 'battle-finished' };
    if (now < battle.startsAt) return { ok: false, code: 'battle-not-started' };
    if (now >= battle.endsAt) return { ok: false, code: 'battle-finished' };
    const ownIndex = battle.players.findIndex((entry) => entry.player.firebaseUid === firebaseUid);
    if (ownIndex < 0) return { ok: false, code: 'not-a-player' };
    const player = battle.players[ownIndex as 0 | 1];
    const opponent = battle.players[ownIndex === 0 ? 1 : 0];
    const prompt = this.promptFor(player);
    if (prompt.id !== promptId) return { ok: false, code: 'wrong-prompt' };
    const normalizedInput = player.currentInput;
    if (!prompt.romaji.includes(normalizedInput)) return { ok: false, code: 'incomplete-input' };

    const elapsedMs = now - player.promptStartedAt;
    const minimumMs = normalizedInput.length * 40; // 300 WPMを超える即時送信を拒否する。
    if (elapsedMs < minimumMs) return { ok: false, code: 'too-fast' };
    const wpm = Math.min(300, Math.round(normalizedInput.length * 12_000 / Math.max(1, elapsedMs)));
    const damage = characterDamage(Math.min(35, Math.max(18, 18 + Math.floor(Math.max(0, wpm - 30) / 20))), player.player.character ?? 'balanced');
    player.totalCharacters += normalizedInput.length;
    player.completedPrompts += 1;
    player.promptIndex += 1;
    player.promptStartedAt = now;
    player.currentInput = '';
    opponent.hp = Math.max(0, opponent.hp - damage);

    if (opponent.hp === 0) {
      battle.outcome = this.makeOutcome(battle, firebaseUid, opponent.player.firebaseUid, 'knockout', now);
      this.uidToMatch.delete(firebaseUid);
      this.uidToMatch.delete(opponent.player.firebaseUid);
    }
    const snapshots: [BattleSnapshot, BattleSnapshot] = [this.makeSnapshot(battle, 0), this.makeSnapshot(battle, 1)];
    return { ok: true, damage, snapshots, outcome: battle.outcome };
  }

  forfeit(matchId: string, disconnectedUid: string, now = Date.now()): BattleOutcome | null {
    const battle = this.battles.get(matchId);
    if (!battle || battle.outcome) return battle?.outcome ?? null;
    const player = battle.players.find((entry) => entry.player.firebaseUid === disconnectedUid);
    if (!player) return null;
    const opponent = battle.players.find((entry) => entry.player.firebaseUid !== disconnectedUid);
    battle.outcome = this.makeOutcome(battle, opponent?.player.firebaseUid ?? null, disconnectedUid, 'disconnect', now);
    this.uidToMatch.delete(disconnectedUid);
    if (opponent) this.uidToMatch.delete(opponent.player.firebaseUid);
    return battle.outcome;
  }

  timeout(matchId: string, now = Date.now()): BattleOutcome | null {
    const battle = this.battles.get(matchId);
    if (!battle || battle.outcome || now < battle.endsAt) return null;
    const [one, two] = battle.players;
    const winner = one.hp === two.hp ? null : one.hp > two.hp ? one : two;
    const loser = one.hp === two.hp ? null : one.hp > two.hp ? two : one;
    battle.outcome = this.makeOutcome(battle, winner?.player.firebaseUid ?? null, loser?.player.firebaseUid ?? null, 'timeout', now);
    this.uidToMatch.delete(one.player.firebaseUid);
    this.uidToMatch.delete(two.player.firebaseUid);
    return battle.outcome;
  }

  matchForUser(firebaseUid: string): string | null { return this.uidToMatch.get(firebaseUid) ?? null; }

  clear(matchId: string): void { this.battles.delete(matchId); }

  private promptFor(player: PlayerState): Prompt {
    return player.promptOrder[player.promptIndex % player.promptOrder.length];
  }

  private accuracy(player: PlayerState): number {
    const attempts = player.correctKeystrokes + player.mistakes;
    return attempts === 0 ? 100 : Math.round(player.correctKeystrokes / attempts * 100);
  }

  private makeOutcome(battle: Battle, winnerUid: string | null, loserUid: string | null, reason: BattleOutcome['reason'], now: number): BattleOutcome {
    return {
      matchId: battle.matchId,
      winnerUid,
      loserUid,
      reason,
      finishedAt: now,
      players: battle.players.map(({ player, totalCharacters, correctKeystrokes, mistakes, maxCombo }) => ({
        firebaseUid: player.firebaseUid,
        userId: player.userId,
        rating: player.rating,
        wpm: totalCharacters === 0 ? 0 : Math.round(totalCharacters * 12_000 / Math.max(1, now - battle.startsAt)),
        accuracy: correctKeystrokes + mistakes === 0 ? 100 : Math.round(correctKeystrokes / (correctKeystrokes + mistakes) * 100),
        characters: totalCharacters,
        mistakes,
        maxCombo,
      })) as [BattlePlayerResult, BattlePlayerResult],
    };
  }

  private makeSnapshot(battle: Battle, ownIndex: 0 | 1): BattleSnapshot {
    const own = battle.players[ownIndex];
    const opponent = battle.players[ownIndex === 0 ? 1 : 0];
    const prompt = this.promptFor(own);
    return {
      matchId: battle.matchId,
      opponent: {
        displayName: opponent.player.displayName,
        rating: opponent.player.rating,
        character: opponent.player.character ?? 'balanced',
      },
      character: own.player.character ?? 'balanced',
      ownHp: own.hp,
      opponentHp: opponent.hp,
      prompt: { id: prompt.id, text: prompt.text, reading: prompt.reading, category: prompt.category },
      completedPrompts: own.completedPrompts,
      typed: own.currentInput,
      accuracy: this.accuracy(own),
      mistakes: own.mistakes,
      maxCombo: own.maxCombo,
      startsAt: battle.startsAt,
      endsAt: battle.endsAt,
    };
  }
}
