import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  updateDoc,
  runTransaction,
  arrayUnion,
} from '@angular/fire/firestore';
import { RoomData } from './room-state.service';

// If randomisePick is enabled, swaps a random same-tier player into the next
// slot so the rest of the auction logic can stay sequential. Returns a new
// players array (or the original if randomisePick is off / no candidates).
function randomiseNext(room: RoomData): RoomData['players'] {
  const next = room.currentPlayerIndex + 1;
  if (!room.randomisePick || next >= room.players.length) return room.players;

  const tier = room.players[room.currentPlayerIndex]?.marqueeType;
  const candidates = room.players
    .map((p, i) => i)
    .filter(i => i >= next && room.players[i].marqueeType === tier);

  if (candidates.length === 0) return room.players;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  if (pick === next) return room.players;

  const updated = [...room.players];
  [updated[next], updated[pick]] = [updated[pick], updated[next]];
  return updated;
}

@Injectable({
  providedIn: 'root',
})
export class AuctionService {
  private firestore = inject(Firestore);

  // Places a bid atomically. Only commits if bidAmount > currentBid
  // and the team's remaining budget covers the bid.
  async placeBid(roomId: string, teamName: string, bidAmount: number): Promise<void> {
    const roomRef = doc(this.firestore, 'rooms', roomId);
    await runTransaction(this.firestore, async tx => {
      const snap = await tx.get(roomRef);
      const room = snap.data() as RoomData;
      if (bidAmount <= room.currentBid) return;
      if ((room.teamBudgets[teamName] ?? 0) < bidAmount) return;
      const entry = { team: teamName, amount: bidAmount, at: Date.now() };
      tx.update(roomRef, {
        currentBid: bidAmount,
        currentBidder: teamName,
        bidHistory: arrayUnion(entry),
      });
    });
  }

  // Marks the current player as sold to the highest bidder. Deducts the
  // winning bid from that team's budget, appends to soldPlayers, resets bid
  // state, and advances to the next player (or sets status 'done' if last).
  async markSold(roomId: string): Promise<void> {
    const roomRef = doc(this.firestore, 'rooms', roomId);
    await runTransaction(this.firestore, async tx => {
      const snap = await tx.get(roomRef);
      const room = snap.data() as RoomData;
      if (!room.currentBidder || room.currentBid === 0) return;

      const player = room.players[room.currentPlayerIndex];
      const nextIndex = room.currentPlayerIndex + 1;
      const players = randomiseNext(room);
      const isDone = nextIndex >= players.length;

      const newBudgets = { ...room.teamBudgets };
      newBudgets[room.currentBidder] = +((newBudgets[room.currentBidder] ?? 0) - room.currentBid).toFixed(2);

      tx.update(roomRef, {
        soldPlayers: arrayUnion({
          playerName: player.name,
          soldTo: room.currentBidder,
          soldFor: room.currentBid,
        }),
        teamBudgets: newBudgets,
        players,
        currentBid: 0,
        currentBidder: null,
        currentPlayerIndex: nextIndex,
        bidHistory: [],
        status: isDone ? 'done' : 'auction',
      });
    });
  }

  // Reverses the last markSold: removes the last soldPlayers entry, refunds the
  // winning team's budget, and steps currentPlayerIndex back by one.
  async undoLastSale(roomId: string): Promise<void> {
    const roomRef = doc(this.firestore, 'rooms', roomId);
    await runTransaction(this.firestore, async tx => {
      const snap = await tx.get(roomRef);
      const room = snap.data() as RoomData;
      if (!room.soldPlayers?.length || room.currentPlayerIndex === 0) return;

      const last = room.soldPlayers[room.soldPlayers.length - 1];
      const newSoldPlayers = room.soldPlayers.slice(0, -1);

      const newBudgets = { ...room.teamBudgets };
      newBudgets[last.soldTo] = +((newBudgets[last.soldTo] ?? 0) + last.soldFor).toFixed(2);

      tx.update(roomRef, {
        soldPlayers: newSoldPlayers,
        teamBudgets: newBudgets,
        currentPlayerIndex: room.currentPlayerIndex - 1,
        currentBid: 0,
        currentBidder: null,
        bidHistory: [],
        status: 'auction',
      });
    });
  }

  // Swaps the chosen player directly into the current auction slot, displacing
  // the current player back to the chosen player's old position. Resets bid state.
  async auctionNow(roomId: string, playerIndex: number): Promise<void> {
    const roomRef = doc(this.firestore, 'rooms', roomId);
    await runTransaction(this.firestore, async tx => {
      const snap = await tx.get(roomRef);
      const room = snap.data() as RoomData;
      const cur = room.currentPlayerIndex;
      if (playerIndex === cur) return;
      const newPlayers = [...room.players];
      const playerName = room.players[playerIndex].name;
      [newPlayers[cur], newPlayers[playerIndex]] = [newPlayers[playerIndex], newPlayers[cur]];
      tx.update(roomRef, {
        players: newPlayers,
        currentBid: 0,
        currentBidder: null,
        bidHistory: [],
        notification: { message: playerName, at: Date.now() },
      });
    });
  }

  // Immediately ends the auction for all participants.
  async endAuction(roomId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'rooms', roomId), { status: 'done' });
  }

  // Skips the current player without selling. Advances to the next player
  // (or sets status 'done' if there are no more players).
  async skipPlayer(roomId: string): Promise<void> {
    const roomRef = doc(this.firestore, 'rooms', roomId);
    await runTransaction(this.firestore, async tx => {
      const snap = await tx.get(roomRef);
      const room = snap.data() as RoomData;

      const nextIndex = room.currentPlayerIndex + 1;
      const players = randomiseNext(room);
      const isDone = nextIndex >= players.length;

      tx.update(roomRef, {
        players,
        currentBid: 0,
        currentBidder: null,
        currentPlayerIndex: nextIndex,
        bidHistory: [],
        status: isDone ? 'done' : 'auction',
      });
    });
  }
}
