import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { eq } from 'drizzle-orm';
import { config } from './config.js';
import { authenticateBearer } from './auth/bearer.js';
import { db } from './database/client.js';
import { users } from './database/schema.js';
import { Matchmaker, type QueueEntry } from './matchmaking/matchmaker.js';
import { createPrivateMatchId, PrivateMatchmaker, type PrivateMatchInvite } from './matchmaking/private-matches.js';
import { z } from 'zod';
import { BattleManager, type BattleOutcome } from './battles/battle-manager.js';
import { persistBattleOutcome, type MatchMode } from './battles/result-service.js';

declare module 'socket.io' {
  interface SocketData { firebaseUid: string }
}

export const RECONNECT_GRACE_MS = 15_000;

export function attachRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    serveClient: false,
    cors: { origin: config.WEB_ORIGIN, credentials: true },
    transports: ['websocket', 'polling'],
  });
  const matchmaker = new Matchmaker();
  const privateMatchmaker = new PrivateMatchmaker();
  const online = new Map<string, string>();
  const activeMatches = new Map<string, { matchId: string; mode: MatchMode; opponentUid: string; opponentSocketId: string; room: string; playerIndex: 0 | 1 }>();
  const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const battleTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const battles = new BattleManager();
  const finalizing = new Set<string>();

  const finishMatch = async (match: { matchId: string; mode: MatchMode; opponentUid: string; opponentSocketId: string; room: string; playerIndex: 0 | 1 }, outcome: BattleOutcome) => {
    if (finalizing.has(match.matchId)) return;
    finalizing.add(match.matchId);
    const battleTimer = battleTimers.get(match.matchId);
    if (battleTimer) clearTimeout(battleTimer);
    battleTimers.delete(match.matchId);
    let saved: Awaited<ReturnType<typeof persistBattleOutcome>> | null = null;
    try {
      if (!db) throw new Error('database-not-configured');
      saved = await persistBattleOutcome(db, outcome, match.mode);
    } catch (error) {
      // DB障害の詳細はサーバーログだけに残し、認証情報やSQLをクライアントへ返さない。
      console.error('battle-result-persistence-failed', error instanceof Error ? error.message : 'unknown');
    }
    for (const [index, player] of outcome.players.entries()) {
      const socketId = socketForUid(player.firebaseUid);
      if (!socketId) continue;
      io.to(socketId).emit('battle:finished', {
        result: outcome.winnerUid === player.firebaseUid ? 'win' : outcome.winnerUid === null ? 'draw' : 'lose',
        reason: outcome.reason,
        resultSaved: saved !== null,
        mode: match.mode,
        stats: { wpm: player.wpm, accuracy: player.accuracy, characters: player.characters, mistakes: player.mistakes, maxCombo: player.maxCombo },
        ...(saved ? { ratingChange: saved.ratingChanges[index as 0 | 1], rating: saved.ratings[index as 0 | 1], coins: saved.coinRewards[index as 0 | 1] } : {}),
      });
    }
    if (!saved) io.to(match.room).emit('battle:persistence-error', { code: 'result-not-saved' });
    const playerUids = outcome.players.map((player) => player.firebaseUid);
    for (const uid of playerUids) {
      activeMatches.delete(uid);
      const timer = disconnectTimers.get(uid);
      if (timer) clearTimeout(timer);
      disconnectTimers.delete(uid);
    }
    const roomSockets = await io.in(match.room).fetchSockets();
    for (const roomSocket of roomSockets) await roomSocket.leave(match.room);
    battles.clear(match.matchId);
    finalizing.delete(match.matchId);
  };

  const socketForUid = (uid: string) => online.get(uid);

  const startMatch = async (matchId: string, players: [QueueEntry, QueueEntry], mode: MatchMode) => {
    const [playerOne, playerTwo] = players;
    const room = `match:${matchId}`;
    activeMatches.set(playerOne.firebaseUid, { matchId, mode, opponentUid: playerTwo.firebaseUid, opponentSocketId: playerTwo.socketId, room, playerIndex: 0 });
    activeMatches.set(playerTwo.firebaseUid, { matchId, mode, opponentUid: playerOne.firebaseUid, opponentSocketId: playerOne.socketId, room, playerIndex: 1 });
    battles.create(matchId, players, Date.now());
    const deadline = battles.snapshot(matchId, playerOne.firebaseUid)?.endsAt;
    if (deadline) {
      const timer = setTimeout(() => {
        battleTimers.delete(matchId);
        const outcome = battles.timeout(matchId);
        const activeMatch = activeMatches.get(playerOne.firebaseUid) ?? activeMatches.get(playerTwo.firebaseUid);
        if (outcome && activeMatch) void finishMatch(activeMatch, outcome);
      }, Math.max(0, deadline - Date.now()));
      battleTimers.set(matchId, timer);
    }

    await io.sockets.sockets.get(playerOne.socketId)?.join(room);
    await io.sockets.sockets.get(playerTwo.socketId)?.join(room);
    if (activeMatches.get(playerOne.firebaseUid)?.matchId !== matchId || activeMatches.get(playerTwo.firebaseUid)?.matchId !== matchId) return;

    const playerOneSocket = io.sockets.sockets.get(playerOne.socketId);
    const playerTwoSocket = io.sockets.sockets.get(playerTwo.socketId);
    playerOneSocket?.emit('matchmaking:matched', { matchId, mode, opponent: { displayName: playerTwo.displayName, rating: playerTwo.rating } });
    playerTwoSocket?.emit('matchmaking:matched', { matchId, mode, opponent: { displayName: playerOne.displayName, rating: playerOne.rating } });
    const oneSnapshot = battles.snapshot(matchId, playerOne.firebaseUid);
    const twoSnapshot = battles.snapshot(matchId, playerTwo.firebaseUid);
    if (oneSnapshot) playerOneSocket?.emit('battle:starting', { ...oneSnapshot, mode });
    if (twoSnapshot) playerTwoSocket?.emit('battle:starting', { ...twoSnapshot, mode });
  };

  const emitPrivateError = (socketId: string, code: string) => io.to(socketId).emit('private:error', { code });

  const isInvite = (invite: PrivateMatchInvite | null): invite is PrivateMatchInvite => invite !== null;

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const auth = await authenticateBearer(typeof token === 'string' ? `Bearer ${token}` : undefined);
    if (!auth.ok) return next(new Error(auth.code));
    socket.data.firebaseUid = auth.identity.uid;
    next();
  });

  io.on('connection', async (socket) => {
    const firebaseUid = socket.data.firebaseUid as string;
    const existingSocketId = online.get(firebaseUid);
    online.set(firebaseUid, socket.id);
    if (existingSocketId && existingSocketId !== socket.id) io.sockets.sockets.get(existingSocketId)?.disconnect(true);
    io.emit('presence:count', online.size);

    const resumedMatch = activeMatches.get(firebaseUid);
    if (resumedMatch) {
      const timer = disconnectTimers.get(firebaseUid);
      if (timer) clearTimeout(timer);
      disconnectTimers.delete(firebaseUid);
      const opponentMatch = activeMatches.get(resumedMatch.opponentUid);
      if (opponentMatch?.matchId === resumedMatch.matchId) {
        activeMatches.set(resumedMatch.opponentUid, { ...opponentMatch, opponentSocketId: socket.id });
      }
      const liveOpponentSocketId = online.get(resumedMatch.opponentUid);
      const updatedMatch = liveOpponentSocketId
        ? { ...resumedMatch, opponentSocketId: liveOpponentSocketId }
        : resumedMatch;
      activeMatches.set(firebaseUid, updatedMatch);
      await socket.join(resumedMatch.room);
      const snapshot = battles.snapshot(resumedMatch.matchId, firebaseUid);
      if (snapshot) socket.emit('battle:starting', { ...snapshot, mode: resumedMatch.mode, resumed: true });
    }

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

      privateMatchmaker.removeHost(firebaseUid);
      if (activeMatches.has(firebaseUid)) return socket.emit('matchmaking:error', { code: 'already-in-match' });
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

      await startMatch(result.ticket.id, result.ticket.players, 'ranked');
    });

    socket.on('matchmaking:cancel', () => {
      const cancelled = matchmaker.cancelSocket(socket.id);
      socket.emit('matchmaking:cancelled', { cancelled });
    });

    socket.on('private:create', async () => {
      if (activeMatches.has(firebaseUid)) return emitPrivateError(socket.id, 'already-in-match');
      if (!db) return emitPrivateError(socket.id, 'database-not-configured');
      const cancelled = matchmaker.removeUser(firebaseUid);
      if (cancelled) socket.emit('matchmaking:cancelled', { cancelled: true });

      let profile: { userId: string; displayName: string; rating: number } | undefined;
      try {
        [profile] = await db.select({ userId: users.id, displayName: users.displayName, rating: users.rating })
          .from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);
      } catch {
        return emitPrivateError(socket.id, 'database-unavailable');
      }
      if (!profile) return emitPrivateError(socket.id, 'profile-not-found');
      if (activeMatches.has(firebaseUid)) return emitPrivateError(socket.id, 'already-in-match');
      matchmaker.removeUser(firebaseUid);

      const invite = privateMatchmaker.create({
        firebaseUid,
        userId: profile.userId,
        socketId: socket.id,
        displayName: profile.displayName,
        rating: profile.rating,
        queuedAt: Date.now(),
      });
      socket.emit('private:created', { code: invite.code, expiresAt: invite.expiresAt });
    });

    socket.on('private:join', async (payload: unknown) => {
      const parsed = z.object({ code: z.string().regex(/^\d{4}$/) }).strict().safeParse(payload);
      if (!parsed.success) return emitPrivateError(socket.id, 'invalid-code');
      if (activeMatches.has(firebaseUid)) return emitPrivateError(socket.id, 'already-in-match');
      if (!db) return emitPrivateError(socket.id, 'database-not-configured');

      const invite = privateMatchmaker.get(parsed.data.code);
      if (!isInvite(invite)) return emitPrivateError(socket.id, 'invalid-code');
      if (invite.host.firebaseUid === firebaseUid) return emitPrivateError(socket.id, 'own-code');
      if (activeMatches.has(invite.host.firebaseUid)) {
        privateMatchmaker.removeHost(invite.host.firebaseUid);
        return emitPrivateError(socket.id, 'already-in-match');
      }
      if (online.get(invite.host.firebaseUid) !== invite.host.socketId || !io.sockets.sockets.get(invite.host.socketId)?.connected) {
        privateMatchmaker.removeHost(invite.host.firebaseUid);
        return emitPrivateError(socket.id, 'host-offline');
      }

      let profile: { userId: string; displayName: string; rating: number } | undefined;
      try {
        [profile] = await db.select({ userId: users.id, displayName: users.displayName, rating: users.rating })
          .from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);
      } catch {
        return emitPrivateError(socket.id, 'database-unavailable');
      }
      if (!profile) return emitPrivateError(socket.id, 'profile-not-found');
      if (activeMatches.has(firebaseUid)) return emitPrivateError(socket.id, 'already-in-match');
      if (activeMatches.has(invite.host.firebaseUid)) {
        privateMatchmaker.removeHost(invite.host.firebaseUid);
        return emitPrivateError(socket.id, 'already-in-match');
      }
      const consumed = privateMatchmaker.consume(parsed.data.code);
      if (!consumed) return emitPrivateError(socket.id, 'invalid-code');

      const joiner = {
        firebaseUid,
        userId: profile.userId,
        socketId: socket.id,
        displayName: profile.displayName,
        rating: profile.rating,
        queuedAt: Date.now(),
      };
      await startMatch(createPrivateMatchId(), [consumed.host, joiner], 'private');
    });

    socket.on('battle:key', (payload: unknown) => {
      const parsed = z.object({ matchId: z.string().uuid(), promptId: z.string().min(1).max(32), key: z.string().max(16) }).strict().safeParse(payload);
      if (!parsed.success) return socket.emit('battle:error', { code: 'invalid-payload' });
      const activeMatch = activeMatches.get(firebaseUid);
      if (!activeMatch || activeMatch.matchId !== parsed.data.matchId) return socket.emit('battle:error', { code: 'not-in-match' });
      const timedOut = battles.timeout(parsed.data.matchId);
      if (timedOut) return void finishMatch(activeMatch, timedOut);
      const result = battles.typeKey(parsed.data.matchId, firebaseUid, parsed.data.promptId, parsed.data.key);
      if (!result.ok) return socket.emit('battle:error', { code: result.code });
      socket.emit('battle:input-state', { promptId: parsed.data.promptId, typed: result.typed, mistakes: result.mistakes, accuracy: result.accuracy, combo: result.combo, maxCombo: result.maxCombo });
    });

    socket.on('battle:submit', (payload: unknown) => {
      const parsed = z.object({ matchId: z.string().uuid(), promptId: z.string().min(1).max(32) }).strict().safeParse(payload);
      if (!parsed.success) return socket.emit('battle:error', { code: 'invalid-payload' });
      const activeMatch = activeMatches.get(firebaseUid);
      if (!activeMatch || activeMatch.matchId !== parsed.data.matchId) return socket.emit('battle:error', { code: 'not-in-match' });
      const timedOut = battles.timeout(parsed.data.matchId);
      if (timedOut) return void finishMatch(activeMatch, timedOut);
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
      privateMatchmaker.removeHost(firebaseUid);
      const isCurrentSocket = online.get(firebaseUid) === socket.id;
      const activeMatch = isCurrentSocket ? activeMatches.get(firebaseUid) : undefined;
      if (isCurrentSocket) online.delete(firebaseUid);
      if (activeMatch) {
        const existingTimer = disconnectTimers.get(firebaseUid);
        if (existingTimer) clearTimeout(existingTimer);
        const timer = setTimeout(() => {
          disconnectTimers.delete(firebaseUid);
          if (online.has(firebaseUid) || activeMatches.get(firebaseUid)?.matchId !== activeMatch.matchId) return;
          const outcome = battles.forfeit(activeMatch.matchId, firebaseUid);
          if (outcome) void finishMatch(activeMatch, outcome);
        }, RECONNECT_GRACE_MS);
        disconnectTimers.set(firebaseUid, timer);
      }
      io.emit('presence:count', online.size);
    });
  });

  const shutdownGracefully = async () => {
    await new Promise<void>((resolve) => io.close(() => resolve()));
    for (const timer of disconnectTimers.values()) clearTimeout(timer);
    for (const timer of battleTimers.values()) clearTimeout(timer);
    disconnectTimers.clear();
    battleTimers.clear();
  };

  return Object.assign(io, { shutdownGracefully });
}
