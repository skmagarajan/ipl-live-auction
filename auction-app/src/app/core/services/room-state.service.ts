import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Firestore, doc, onSnapshot, Unsubscribe } from '@angular/fire/firestore';

export interface Player {
  name: string;
  basePrice: number;
  status: 'pending' | 'sold' | 'skipped';
  role?: string;
  iplTeam?: string;
  nationality?: string;
  marqueeType?: string;
  uncapped?: boolean;
  headshotUrl?: string;
}

export interface SoldPlayer {
  playerName: string;
  soldTo: string;
  soldFor: number;
}

export interface BidEntry {
  team: string;
  amount: number;
  at: number; // client epoch ms
}

export interface RoomData {
  roomId: string;
  teams: string[];
  status: 'waiting' | 'ready' | 'auction' | 'done';
  auctioneer: string | null;
  players: Player[];
  currentPlayerIndex: number;
  currentBid: number;
  currentBidder: string | null;
  soldPlayers: SoldPlayer[];
  teamBudgets: Record<string, number>;
  bidHistory: BidEntry[];
  randomisePick: boolean;
  notification?: { message: string; at: number };
  minRequirements?: Record<string, number>;
  minReqsEnabled?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class RoomStateService {
  private firestore = inject(Firestore);

  private roomSubject = new BehaviorSubject<RoomData | null>(null);

  // Public observable that components subscribe to for real-time room state.
  room$ = this.roomSubject.asObservable();

  private unsubscribeFn: Unsubscribe | null = null;

  // Attaches a Firestore onSnapshot listener to rooms/{roomId} and pushes
  // every document update into room$ so all subscribers receive it instantly.
  watchRoom(roomId: string): void {
    this.stopWatching();
    const ref = doc(this.firestore, 'rooms', roomId);
    this.unsubscribeFn = onSnapshot(ref, snapshot => {
      if (snapshot.exists()) {
        this.roomSubject.next(snapshot.data() as RoomData);
      } else {
        this.roomSubject.next(null);
      }
    });
  }

  // Detaches the Firestore listener and resets room state.
  stopWatching(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
    this.roomSubject.next(null);
  }
}
