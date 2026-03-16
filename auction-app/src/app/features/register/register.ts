import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Room } from '../../core/services/room';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private roomService = inject(Room);

  roomId = this.route.snapshot.paramMap.get('roomId')!;

  form = this.fb.group({
    teamName: ['', [Validators.required, Validators.minLength(3)]],
  });

  submitting = signal(false);

  // Writes the team name to Firestore then redirects to the lobby.
  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    try {
      const teamName = this.form.value.teamName!;
      await this.roomService.joinRoom(this.roomId, teamName);
      this.router.navigate(['/room', this.roomId, 'lobby'], {
        queryParams: { team: teamName },
      });
    } finally {
      this.submitting.set(false);
    }
  }
}
