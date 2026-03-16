import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  arrayUnion,
} from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class Room {
  private firestore = inject(Firestore);

  // Creates a new room document with all required fields and returns its ID.
  async createRoom(): Promise<string> {
    const roomId = crypto.randomUUID();
    await setDoc(doc(this.firestore, 'rooms', roomId), {
      roomId,
      createdAt: serverTimestamp(),
      teams: [],
      status: 'waiting',
      auctioneer: null,
      players: [],
      currentPlayerIndex: 0,
      currentBid: 0,
      currentBidder: null,
      soldPlayers: [],
      teamBudgets: {},
      bidHistory: [],
      randomisePick: false,
    });
    return roomId;
  }

  // Atomically appends teamName to the teams array (idempotent via arrayUnion).
  async joinRoom(roomId: string, teamName: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'rooms', roomId), {
      teams: arrayUnion(teamName),
    });
  }

  // Claims the auctioneer role only if no one has claimed it yet (race-safe).
  async claimAuctioneer(roomId: string, teamName: string): Promise<void> {
    const roomRef = doc(this.firestore, 'rooms', roomId);
    await runTransaction(this.firestore, async tx => {
      const snap = await tx.get(roomRef);
      if ((snap.data() as any)?.auctioneer === null) {
        tx.update(roomRef, { auctioneer: teamName });
      }
    });
  }

  // Sets the chosen auctioneer for the room.
  async setAuctioneer(roomId: string, teamName: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'rooms', roomId), {
      auctioneer: teamName,
    });
  }

  // Replaces the entire players array with the provided list (bulk import from Excel).
  async setPlayers(roomId: string, players: { name: string; basePrice: number; status: string }[]): Promise<void> {
    await updateDoc(doc(this.firestore, 'rooms', roomId), { players });
  }

  async setRandomisePick(roomId: string, value: boolean): Promise<void> {
    await updateDoc(doc(this.firestore, 'rooms', roomId), { randomisePick: value });
  }

  // Sets status to 'auction' and initialises every team's budget at ₹100 Cr.
  async startAuction(roomId: string, teamBudgets: Record<string, number>): Promise<void> {
    await updateDoc(doc(this.firestore, 'rooms', roomId), {
      status: 'auction',
      teamBudgets,
    });
  }
}
