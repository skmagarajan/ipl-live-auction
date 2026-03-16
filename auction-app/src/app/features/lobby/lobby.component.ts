import { Component, OnInit, OnDestroy, inject, DestroyRef, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { RoomStateService, RoomData } from '../../core/services/room-state.service';
import { Room } from '../../core/services/room';
import { PlayerDataService } from '../../core/services/player-data.service';

interface MarqueeType {
  key: string;
  label: string;
  count: number;
  color: string;
}

@Component({
  selector: 'app-lobby',
  imports: [
    AsyncPipe,
    DragDropModule,
    FormsModule,
    MatListModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatTooltipModule,
    MatSlideToggleModule,
  ],
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.scss',
})
export class LobbyComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  readonly roomStateService = inject(RoomStateService);
  private roomService = inject(Room);
  private playerDataService = inject(PlayerDataService);

  roomId = this.route.snapshot.paramMap.get('roomId')!;
  teamName = this.route.snapshot.queryParamMap.get('team') ?? '';
  starting = false;
  copied = false;
  saving = false;
  saveError = '';

  // Drag-and-drop marquee order — default follows BAT/WK/BOWL/AR tier progression.
  marqueeOrder: MarqueeType[] = [
    { key: 'BAT1',  label: 'Batters — Tier 1',        count: 0, color: '#1565c0' },
    { key: 'WK1',   label: 'Wicket-Keepers — Tier 1', count: 0, color: '#2e7d32' },
    { key: 'BOWL1', label: 'Bowlers — Tier 1',         count: 0, color: '#e65100' },
    { key: 'AR1',   label: 'All-rounders — Tier 1',   count: 0, color: '#6a1b9a' },
    { key: 'BAT2',  label: 'Batters — Tier 2',        count: 0, color: '#1565c0' },
    { key: 'WK2',   label: 'Wicket-Keepers — Tier 2', count: 0, color: '#2e7d32' },
    { key: 'BOWL2', label: 'Bowlers — Tier 2',         count: 0, color: '#e65100' },
    { key: 'AR2',   label: 'All-rounders — Tier 2',   count: 0, color: '#6a1b9a' },
    { key: 'BAT3',  label: 'Batters — Tier 3',        count: 0, color: '#1565c0' },
    { key: 'BOWL3', label: 'Bowlers — Tier 3',         count: 0, color: '#e65100' },
    { key: 'AR3',   label: 'All-rounders — Tier 3',   count: 0, color: '#6a1b9a' },
    { key: 'BOWL4', label: 'Bowlers — Tier 4',         count: 0, color: '#e65100' },
  ];

  get registerUrl(): string {
    return `${location.origin}/room/${this.roomId}/register`;
  }

  async copyRegisterUrl(): Promise<void> {
    await navigator.clipboard.writeText(this.registerUrl);
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }

  private auctioneerClaimed = false;

  ngOnInit(): void {
    this.roomStateService.watchRoom(this.roomId);

    this.roomStateService.room$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(room => {
      if (!room) return;

      if (room.status === 'auction') {
        this.router.navigate(['/room', this.roomId, 'auction'], {
          queryParams: { team: this.teamName },
        });
        return;
      }

      // First person into the lobby auto-claims auctioneer (race-safe transaction).
      if (!this.auctioneerClaimed && room.auctioneer === null && this.teamName) {
        this.auctioneerClaimed = true;
        this.roomService.claimAuctioneer(this.roomId, this.teamName);
      }

    });

    // Load player counts per marquee type for display (uses cached data).
    this.playerDataService.getPlayers().then(players => {
      const counts: Record<string, number> = {};
      players.forEach(p => { if (p.marqueeType) counts[p.marqueeType] = (counts[p.marqueeType] ?? 0) + 1; });
      this.marqueeOrder = this.marqueeOrder.map(m => ({ ...m, count: counts[m.key] ?? 0 }));
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.roomStateService.stopWatching();
  }

  // Updates marqueeOrder array when the user drags and drops a row.
  onDrop(event: CdkDragDrop<MarqueeType[]>): void {
    moveItemInArray(this.marqueeOrder, event.previousIndex, event.currentIndex);
  }

  // Loads all players, sorts them by the current marqueeOrder, then saves to Firestore.
  async savePlayerOrder(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    this.saveError = '';
    try {
      const allPlayers = await this.playerDataService.getPlayers();
      const sorted = this.marqueeOrder.flatMap(m => allPlayers.filter(p => p.marqueeType === m.key));
      await this.roomService.setPlayers(this.roomId, sorted);
    } catch (err) {
      this.saveError = (err as Error).message;
    } finally {
      this.saving = false;
    }
  }

  async onAuctioneerChange(teamName: string): Promise<void> {
    await this.roomService.setAuctioneer(this.roomId, teamName);
  }

  async onRandomisePickChange(value: boolean): Promise<void> {
    await this.roomService.setRandomisePick(this.roomId, value);
  }

  async onStartAuction(room: RoomData): Promise<void> {
    if (!room.auctioneer || room.players.length === 0 || this.starting) return;
    this.starting = true;
    try {
      const teamBudgets: Record<string, number> = {};
      room.teams.forEach(team => (teamBudgets[team] = 100));
      await this.roomService.startAuction(this.roomId, teamBudgets);
    } finally {
      this.starting = false;
    }
  }
}
