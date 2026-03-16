import { Component, OnInit, OnDestroy, inject, signal, DestroyRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RoomStateService, RoomData, SoldPlayer, BidEntry } from '../../core/services/room-state.service';
import { AuctionService } from '../../core/services/auction.service';

@Component({
  selector: 'app-end-confirm-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>End Auction?</h2>
    <mat-dialog-content>
      <p>This will immediately end the auction for all participants and show the final summary. This cannot be undone.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Cancel</button>
      <button mat-raised-button class="end-confirm-btn" [mat-dialog-close]="true">End Auction</button>
    </mat-dialog-actions>
  `,
  styles: [`.end-confirm-btn { background: #c62828 !important; color: #fff !important; }`],
})
export class EndConfirmDialogComponent {}

export interface SummaryRow {
  team: string;
  playersBought: number;
  totalSpent: number;
  remainingBudget: number;
  players: SoldPlayer[];
}

@Component({
  selector: 'app-auction',
  imports: [
    AsyncPipe,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatListModule,
    MatTableModule,
    MatDividerModule,
    MatChipsModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDialogModule,
    MatIconModule,
  ],
  templateUrl: './auction.html',
  styleUrl: './auction.scss',
})
export class Auction implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  readonly roomStateService = inject(RoomStateService);
  private auctionService = inject(AuctionService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  roomId = this.route.snapshot.paramMap.get('roomId')!;

  // Identifies which team this browser tab belongs to — carried via ?team= query param.
  teamName = this.route.snapshot.queryParamMap.get('team') ?? '';

  bidInput = signal(0);
  pickedPlayerIndex = signal<number | null>(null);
  placing = false;
  selling = false;
  skipping = false;
  picking = false;
  undoing = false;

  // Summary table columns.
  summaryCols = ['team', 'playersBought', 'totalSpent', 'remainingBudget'];

  private lastNotificationAt = 0;

  ngOnInit(): void {
    // Start the real-time Firestore listener (reuse if lobby already started it).
    this.roomStateService.watchRoom(this.roomId);

    // Show a toast on every client when the auctioneer triggers "Auction Now".
    // Skip the first emission (page load) to avoid replaying a stale notification.
    let initialLoad = true;
    this.roomStateService.room$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(room => {
        const n = room?.notification;
        if (n && n.at !== this.lastNotificationAt) {
          this.lastNotificationAt = n.at;
          if (!initialLoad) {
            this.snackBar.open(`🏏 Now on auction: ${n.message}`, '', {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
            });
          }
        }
        initialLoad = false;
      });
  }

  ngOnDestroy(): void {
    this.roomStateService.stopWatching();
  }

  // Opens a confirm dialog then sets status to 'done' for all clients.
  async endAuction(): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.open(EndConfirmDialogComponent, { width: '380px' }).afterClosed()
    );
    if (!confirmed) return;
    await this.auctionService.endAuction(this.roomId);
  }

  // Exports sold players grouped by team to an Excel workbook.
  exportExcel(room: RoomData): void {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summary = room.teams.map(team => {
      const remaining = +(room.teamBudgets[team] ?? 100).toFixed(2);
      return {
        'Team': team,
        'Players Bought': room.soldPlayers.filter(p => p.soldTo === team).length,
        'Total Spent (Cr)': +(100 - remaining).toFixed(2),
        'Remaining Budget (Cr)': remaining,
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');

    // Per-team player sheets
    for (const team of room.teams) {
      const players = room.soldPlayers
        .filter(p => p.soldTo === team)
        .map(p => ({ 'Player': p.playerName, 'Sold For (Cr)': p.soldFor }));
      if (players.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(players), team.slice(0, 31));
      }
    }

    XLSX.writeFile(wb, `ipl-auction-results.xlsx`);
  }

  // Returns the player currently on the block, or null if auction is done.
  currentPlayer(room: RoomData) {
    return room.players[room.currentPlayerIndex] ?? null;
  }

  // True only for the tab belonging to the designated auctioneer.
  isAuctioneer(room: RoomData): boolean {
    return this.teamName === room.auctioneer;
  }

  // Remaining budget for this tab's team in ₹ Cr, rounded to 2 dp.
  myBudget(room: RoomData): number {
    return +((room.teamBudgets[this.teamName] ?? 100)).toFixed(2);
  }

  // Safe 2-dp rounding for template arithmetic (e.g. 100 - remaining).
  r2(n: number): number {
    return +n.toFixed(2);
  }

  // Place Bid button should be disabled when the bid is invalid or budget insufficient.
  bidDisabled(room: RoomData): boolean {
    const bid = this.bidInput();
    return bid <= room.currentBid || bid <= 0 || this.myBudget(room) < bid || this.placing;
  }

  // Quick-bid disabled when currentBid + increment exceeds budget or auction not active.
  quickBidDisabled(room: RoomData, increment: number): boolean {
    const amount = +(room.currentBid + increment).toFixed(2);
    return amount <= 0 || this.myBudget(room) < amount || this.placing;
  }

  // Places a bid at currentBid + increment immediately.
  async quickBid(room: RoomData, increment: number): Promise<void> {
    const amount = +(room.currentBid + increment).toFixed(2);
    if (this.quickBidDisabled(room, increment)) return;
    this.placing = true;
    try {
      await this.auctionService.placeBid(this.roomId, this.teamName, amount);
      this.bidInput.set(0);
    } finally {
      this.placing = false;
    }
  }

  // Sends a bid to Firestore via a transaction; safe for concurrent bids.
  async placeBid(room: RoomData): Promise<void> {
    if (this.bidDisabled(room)) return;
    this.placing = true;
    try {
      await this.auctionService.placeBid(this.roomId, this.teamName, this.bidInput());
      this.bidInput.set(0);
    } finally {
      this.placing = false;
    }
  }

  // Marks current player as sold; advances to next player or ends auction.
  async markSold(room: RoomData): Promise<void> {
    if (!room.currentBidder || this.selling) return;
    this.selling = true;
    try {
      await this.auctionService.markSold(this.roomId);
    } finally {
      this.selling = false;
    }
  }

  // Skips current player; advances to next player or ends auction.
  async skipPlayer(): Promise<void> {
    if (this.skipping) return;
    this.skipping = true;
    try {
      await this.auctionService.skipPlayer(this.roomId);
    } finally {
      this.skipping = false;
    }
  }

  // Computes per-team summary rows for the done screen.
  getSummaryRows(room: RoomData): SummaryRow[] {
    return room.teams.map(team => {
      const bought = room.soldPlayers.filter(p => p.soldTo === team);
      const remainingBudget = room.teamBudgets[team] ?? 100;
      return {
        team,
        playersBought: bought.length,
        totalSpent: +( 100 - remainingBudget).toFixed(2),
        remainingBudget: +remainingBudget.toFixed(2),
        players: bought,
      };
    });
  }

  // Returns only the players bought by a specific team.
  getTeamPlayers(room: RoomData, team: string): SoldPlayer[] {
    return room.soldPlayers.filter(p => p.soldTo === team);
  }

  // Returns WK / BAT / AR / BOWL / UNCAPPED counts with icon info for a team.
  getTeamRoleBadges(room: RoomData, team: string): { role: string; title: string; icon: string; isEmoji: boolean; count: number }[] {
    const soldNames = new Set(
      room.soldPlayers.filter(p => p.soldTo === team).map(p => p.playerName)
    );
    const counts = { WK: 0, BAT: 0, AR: 0, BOWL: 0, UNCAPPED: 0 };
    for (const p of room.players) {
      if (!soldNames.has(p.name)) continue;
      const r = p.role ?? '';
      if (['Wicketkeeper','WK-Batter','WK-Batsman','WK-B','WK','Wicket-keeper','Wicket Keeper'].includes(r)) counts.WK++;
      else if (['Batter','Batsman'].includes(r)) counts.BAT++;
      else if (['All-rounder','Allrounder','All Rounder'].includes(r)) counts.AR++;
      else if (r === 'Bowler') counts.BOWL++;
      if (p.uncapped) counts.UNCAPPED++;
    }
    return [
      { role: 'WK',      title: 'Wicket-Keeper', icon: 'assets/icons/wk.svg',  isEmoji: false, count: counts.WK      },
      { role: 'BAT',     title: 'Batter',        icon: 'assets/icons/bat.svg',  isEmoji: false, count: counts.BAT     },
      { role: 'AR',      title: 'All-rounder',   icon: 'assets/icons/all.svg',  isEmoji: false, count: counts.AR      },
      { role: 'BOWL',    title: 'Bowler',        icon: 'assets/icons/ball.svg', isEmoji: false, count: counts.BOWL    },
      { role: 'UNCAPPED',title: 'Uncapped',      icon: '🌟',                    isEmoji: true,  count: counts.UNCAPPED},
    ];
  }

  // Returns all players that haven't been sold and aren't the current player,
  // so the auctioneer can manually bring one to the bidding stage.
  getUnsoldPlayers(room: RoomData): Array<{ name: string; index: number; marqueeType?: string }> {
    const soldNames = new Set(room.soldPlayers.map(p => p.playerName));
    return room.players
      .map((p, i) => ({ name: p.name, index: i, marqueeType: p.marqueeType }))
      .filter(p => p.index !== room.currentPlayerIndex && !soldNames.has(p.name));
  }

  async undoLastSale(room: RoomData): Promise<void> {
    if (this.undoing || !room.soldPlayers?.length) return;
    this.undoing = true;
    try {
      await this.auctionService.undoLastSale(this.roomId);
    } finally {
      this.undoing = false;
    }
  }

  async auctionNow(): Promise<void> {
    const idx = this.pickedPlayerIndex();
    if (idx === null || this.picking) return;
    this.picking = true;
    try {
      await this.auctionService.auctionNow(this.roomId, idx);
      this.pickedPlayerIndex.set(null);
    } finally {
      this.picking = false;
    }
  }

  // Returns remaining players in the same marquee tier after the current one.
  getUpcomingPlayers(room: RoomData) {
    const current = room.players[room.currentPlayerIndex];
    if (!current) return [];
    return room.players
      .slice(room.currentPlayerIndex + 1)
      .filter(p => p.marqueeType === current.marqueeType);
  }

  // Returns bid history sorted newest-first.
  getBidHistory(room: RoomData): BidEntry[] {
    return [...(room.bidHistory ?? [])].sort((a, b) => b.at - a.at);
  }

  // Formats epoch ms as HH:MM:SS.
  formatTime(ms: number): string {
    const d = new Date(ms);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
