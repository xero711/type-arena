import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { eq } from 'drizzle-orm';
import { config } from './config.js';
import { authenticateBearer } from './auth/bearer.js';
import { db } from './database/client.js';
import { users } from './database/schema.js';
import { Matchmaker } from './matchmaking/matchmaker.js';
import { z } from 'zod';
import { BattleManager, type BattleOutcome } from './battles/battle-manager.js';
import { persistBattleOutcome } from './battles/result-service.js';

declare module 'socket.io' {
  interface SocketData { firebaseUid: string }
}

export function attachRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    serveClient: false,
    cors: { origin: config.WEB_ORIGIN, credentials: true },
    transports: ['websocket', 'polling'],
  });
  const matchmaker = new Matchmaker();
  const online = new Map<string, string>();
  const activeMatches = new Map<string, { matchId: string; opponentUid: string; opponentSocketId: string; room: string; playerIndex: 0 | 1 }>();
  const battles = new BattleManager();
  const finalizing = new Set<string>();

  const finishMatch = async (match: { matchId: string; opponentUid: string; opponentSocketId: string; room: string; playerIndex: 0 | 1 }, outcome: BattleOutcome) => {
    if (finalizing.has(match.matchId)) return;
    finalizing.add(match.matchId);
    let saved: Awaited<ReturnType<typeof persistBattleOutcome>> | null = null;
    try {
      if (!db) throw new Error('database-not-configured');
      saved = await persistBattleOutcome(db, outcome);
    } catch (error) {
      // DB障害の詳細はサーバーログだけに残し、認証情報やSQLをクライアントへ返さない。
      console.error('battle-result-persistence-failed', error instanceof Error ? error.message : 'unknown');
    }
    for (const [index, player] of outcome.players.entries()) {
      const socketId = index === match.playerIndex ? socketForUid(player.firebaseUid) : match.opponentSocketId;
      if (!socketId) continue;
      io.to(socketId).emit('battle:finished', {
        result: outcome.winnerUid === player.firebaseUid ? 'win' : 'lose',
        reason: outcome.reason,
        resultSaved: saved !== null,
        stats: { wpm: player.wpm, accuracy: player.accuracy, characters: player.characters, mistakes: player.mistakes, maxCombo: player.maxCombo },
        ...(saved ? { ratingChange: saved.ratingChanges[index as 0 | 1], rating: saved.ratings[index as 0 | 1], coins: saved.coinRewards[index as 0 | 1] } : {}),
      });
    }
    if (!saved) io.to(match.room).emit('battle:persistence-error', { code: 'result-not-saved' });
    const playerUids = outcome.players.map((player) => player.firebaseUid);
    for (const uid of playerUids) activeMatches.delete(uid);
    const roomSockets = await io.in(match.room).fetchSockets();
    for (const roomSocket of roomSockets) await roomSocket.leave(match.room);
    battles.clear(match.matchId);
    finalizing.delete(match.matchId);
  };

  const socketForUid = (uid: string) => online.get(uid);

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const auth = await authenticateBearer(typeof token === 'string' ? `Bearer ${token}` : undefined);
    if (!auth.ok) return next(new Error(auth.code));
    socket.data.firebaseUid = auth.identity.uid;
    next();
  });

  io.on('connection', (socket) => {
    const firebaseUid = socket.data.firebaseUid as string;
    const existingSocketId = online.get(firebaseUid);
    if (existingSocketId && existingSocketId !== socket.id) io.sockets.sockets.get(existingSocketId)?.disconnect(true);
    online.set(firebaseUid, socket.id);
    io.emit('presence:count', online.size);

    socket.on('matchmaking:join', async () => {
      if (activeMatches.has(firebaseUid)) return socket.emit('matchmaking:error', { code: 'already-in-match' });
      if (!db) return socket.emit('matchmaking:error', { code: 'database-not-configured' });
      let profile: { userId: string; displayName: string; rating: number } | undefined;
      try {
        [profile] = await db.select({ userId: users.id, displayName: users.displayName, rating: users.rating })
          .from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);
      } catch {
        return socket.emit('matchmaking:error', { code: 'database-unavailable' });
      }
      if (!profile) return socket.emit('matchmaking:error', { code: 'profile-not-found' });

      const result = matchmaker.enqueue({
        firebaseUid,
        userId: profile.userId,
        socketId: socket.id,
        displayName: profile.displayName,
        rating: profile.rating,
        queuedAt: Date.now(),
      });
      if (result.kind === 'already-queued') return socket.emit('matchmaking:error', { code: 'already-queued' });
      if (result.kind === 'queued') return socket.emit('matchmaking:queued', { position: matchmaker.size });

      const [playerOne, playerTwo] = result.ticket.players;
      const room = `match:${result.ticket.id}`;
      activeMatches.set(playerOne.firebaseUid, { matchId: result.ticket.id, opponentUid: playerTwo.firebaseUid, opponentSocketId: playerTwo.socketId, room, playerIndex: 0 });
      activeMatches.set(playerTwo.firebaseUid, { matchId: result.ticket.id, opponentUid: playerOne.firebaseUid, opponentSocketId: playerOne.socketId, room, playerIndex: 1 });
      battles.create(result.ticket.id, [playerOne, playerTwo], Date.now());
      await io.sockets.sockets.get(playerOne.socketId)?.join(room);
      await io.sockets.sockets.get(playerTwo.socketId)?.join(room);
      if (!activeMatches.has(playerOne.firebaseUid) || !activeMatches.has(playerTwo.firebaseUid)) return;
      io.to(playerOne.socketId).emit('matchmaking:matched', {
        matchId: result.ticket.id,
        opponent: { displayName: playerTwo.displayName, rating: playerTwo.rating },
      });
      io.to(playerTwo.socketId).emit('matchmaking:matched', {
        matchId: result.ticket.id,
        opponent: { displayName: playerOne.displayName, rating: playerOne.rating },
      });
      io.to(playerOne.socketId).emit('battle:starting', battles.snapshot(result.ticket.id, playerOne.firebaseUid));
      io.to(playerTwo.socketId).emit('battle:starting', battles.snapshot(result.ticket.id, playerTwo.firebaseUid));
    });

    socket.on('matchmaking:cancel', () => {
      const cancelled = matchmaker.cancelSocket(socket.id);
      socket.emit('matchmaking:cancelled', { cancelled });
    });

    socket.on('battle:key', (payload: unknown) => {
      const parsed = z.object({ matchId: z.string().uuid(), promptId: z.string().min(1).max(32), key: z.string().max(16) }).strict().safeParse(payload);
      if (!parsed.success) return socket.emit('battle:error', { code: 'invalid-payload' });
      const activeMatch = activeMatches.get(firebaseUid);
      if (!activeMatch || activeMatch.matchId !== parsed.data.matchId) return socket.emit('battle:error', { code: 'not-in-match' });
      const result = battles.typeKey(parsed.data.matchId, firebaseUid, parsed.data.promptId, parsed.data.key);
      if (!result.ok) return socket.emit('battle:error', { code: result.code });
      socket.emit('battle:input-state', { promptId: parsed.data.promptId, typed: result.typed, mistakes: result.mistakes, accuracy: result.accuracy, combo: result.combo, maxCombo: result.maxCombo });
    });

    socket.on('battle:submit', (payload: unknown) => {
      const parsed = z.object({ matchId: z.string().uuid(), promptId: z.string().min(1).max(32) }).strict().safeParse(payload);
      if (!parsed.success) return socket.emit('battle:error', { code: 'invalid-payload' });
      const activeMatch = activeMatches.get(firebaseUid);
      if (!activeMatch || activeMatch.matchId !== parsed.data.matchId) return socket.emit('battle:error', { code: 'not-in-match' });
      const result = battles.submit(parsed.data.matchId, firebaseUid, parsed.data.promptId);
      if (!result.ok) return socket.emit('battle:error', { code: result.code });

      const match = activeMatch;
      const ownSnapshot = result.snapshots[match.playerIndex];
      const opponentSnapshot = result.snapshots[match.playerIndex === 0 ? 1 : 0];
      io.to(match.room).emit('battle:damage', { attacker: match.playerIndex, damage: result.damage });
      socket.emit('battle:update', ownSnapshot);
      io.to(match.opponentSocketId).emit('battle:update', opponentSnapshot);
      if (result.outcome) {
        void finishMatch(match, result.outcome);
      }
    });

    socket.on('disconnect', () => {
      matchmaker.cancelSocket(socket.id);
      const activeMatch = activeMatches.get(firebaseUid);
      if (activeMatch) {
        const outcome = battles.forfeit(activeMatch.matchId, firebaseUid);
        if (outcome) void finishMatch(activeMatch, outcome);
      }
      if (online.get(firebaseUid) === socket.id) online.delete(firebaseUid);
      io.emit('presence:count', online.size);
    });
  });

  return io;
}
