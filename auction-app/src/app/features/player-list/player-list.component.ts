import { Component, OnInit, ViewChild, inject, signal, DestroyRef } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Player } from '../../core/services/room-state.service';
import { PlayerDataService } from '../../core/services/player-data.service';

@Component({
  selector: 'app-player-list',
  imports: [
    ReactiveFormsModule,
    MatTableModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './player-list.component.html',
  styleUrl: './player-list.component.scss',
})
export class PlayerListComponent implements OnInit {
  private playerDataService = inject(PlayerDataService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  // Setter handles the case where MatSort is inside a conditionally rendered block.
  // The table is always in the DOM but hidden via CSS while loading, so the
  // ViewChild is available immediately — but this setter future-proofs it.
  @ViewChild(MatSort) set sort(s: MatSort) {
    if (s) this.dataSource.sort = s;
  }

  dataSource = new MatTableDataSource<Player>([]);
  displayedColumns = ['index', 'name', 'iplTeam', 'role', 'nationality', 'basePrice', 'marqueeType'];

  loading = signal(true);
  error = signal('');

  teams = [
    'Chennai Super Kings', 'Delhi Capitals', 'Gujarat Titans',
    'Kolkata Knight Riders', 'Lucknow Super Giants', 'Mumbai Indians',
    'Punjab Kings', 'Rajasthan Royals', 'Royal Challengers Bengaluru',
    'Sunrisers Hyderabad',
  ];
  roles = ['All-rounder', 'Batter', 'Bowler', 'WK-Batter'];
  nationalities = [
    'Afghanistan', 'Australia', 'Bangladesh', 'England', 'India',
    'New Zealand', 'Singapore', 'South Africa', 'Sri Lanka', 'West Indies',
  ];
  basePrices = [0.3, 0.4, 0.5, 0.75, 1, 1.25, 1.5, 2];
  marqueeTypes = ['WK1', 'WK2', 'BAT1', 'BAT2', 'BAT3', 'AR1', 'AR2', 'AR3', 'BOWL1', 'BOWL2', 'BOWL3', 'BOWL4'];

  filters = this.fb.group({
    search: [''],
    team: [''],
    role: [''],
    nationality: [''],
    basePrice: [null as number | null],
    marqueeType: [''],
  });

  ngOnInit(): void {
    // Custom filter predicate checks every active filter against the player row.
    this.dataSource.filterPredicate = (player: Player, filterStr: string) => {
      const f = JSON.parse(filterStr);
      if (f.search && !player.name.toLowerCase().includes(f.search.toLowerCase())) return false;
      if (f.team && player.iplTeam !== f.team) return false;
      if (f.role && player.role !== f.role) return false;
      if (f.nationality && player.nationality !== f.nationality) return false;
      if (f.basePrice !== null && player.basePrice !== f.basePrice) return false;
      if (f.marqueeType && player.marqueeType !== f.marqueeType) return false;
      return true;
    };

    this.playerDataService.getPlayers()
      .then(players => {
        this.dataSource.data = players;
        this.loading.set(false);
      })
      .catch(err => {
        this.error.set((err as Error).message);
        this.loading.set(false);
      });

    // Re-run filter whenever any control value changes.
    this.filters.valueChanges.pipe(
      startWith(this.filters.value),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(f => {
      this.dataSource.filter = JSON.stringify(f);
    });
  }

  clearFilters(): void {
    this.filters.reset({ search: '', team: '', role: '', nationality: '', basePrice: null, marqueeType: '' });
  }

  get activeFilterCount(): number {
    const f = this.filters.value;
    return [f.search, f.team, f.role, f.nationality, f.basePrice, f.marqueeType]
      .filter(v => v !== null && v !== '').length;
  }
}
