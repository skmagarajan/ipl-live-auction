import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then(m => m.Home),
  },
  {
    path: 'room/:roomId/register',
    loadComponent: () => import('./features/register/register').then(m => m.Register),
  },
  {
    path: 'room/:roomId/lobby',
    loadComponent: () =>
      import('./features/lobby/lobby.component').then(m => m.LobbyComponent),
  },
  {
    path: 'room/:roomId/auction',
    loadComponent: () => import('./features/auction/auction').then(m => m.Auction),
  },
  {
    path: 'players',
    loadComponent: () =>
      import('./features/player-list/player-list.component').then(m => m.PlayerListComponent),
  },
  { path: '**', redirectTo: '' },
];
