import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly KEY = 'ipl-theme';
  dark = signal(false);

  constructor() {
    const saved = localStorage.getItem(this.KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.dark.set(saved ? saved === 'dark' : prefersDark);
    this.apply();
  }

  toggle(): void {
    this.dark.update(v => !v);
    this.apply();
    localStorage.setItem(this.KEY, this.dark() ? 'dark' : 'light');
  }

  private apply(): void {
    document.documentElement.classList.toggle('dark', this.dark());
  }
}
