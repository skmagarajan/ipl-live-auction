import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Room } from '../../core/services/room';

@Component({
  selector: 'app-home',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private roomService = inject(Room);
  private router = inject(Router);

  loading = signal(false);

  async createRoom(): Promise<void> {
    this.loading.set(true);
    try {
      const roomId = await this.roomService.createRoom();
      this.router.navigate(['/room', roomId, 'register']);
    } finally {
      this.loading.set(false);
    }
  }
}
