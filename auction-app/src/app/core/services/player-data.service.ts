import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { Player } from './room-state.service';

const PLAYERS_FILE = '/assets/playerList/IPL_2026_AllTeams_v3.xlsx';

@Injectable({ providedIn: 'root' })
export class PlayerDataService {
  private cache: Player[] | null = null;

  // Fetches and parses the Excel file once; returns cached result on subsequent calls.
  // Rows 0-2 are title/description/header — data starts at index 3.
  // Columns: [#, Team, Player Name, Role, Nationality, Base Price (₹ Cr), Marquee Type, Uncapped]
  async getPlayers(): Promise<Player[]> {
    if (this.cache) return this.cache;

    const res = await fetch(PLAYERS_FILE);
    if (!res.ok) throw new Error(`Failed to load player file (HTTP ${res.status})`);

    const buffer = await res.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

    this.cache = rows.slice(3)
      .filter(r => r[2] !== undefined && r[2] !== '')
      .map(r => ({
        name: String(r[2]).trim(),
        iplTeam: String(r[1]).trim(),
        role: String(r[3]).trim(),
        nationality: String(r[4]).trim(),
        basePrice: Number(r[5]),
        marqueeType: String(r[6]).trim(),
        uncapped: String(r[7]).trim().toLowerCase() === 'yes',
        status: 'pending' as const,
      }));

    return this.cache;
  }
}
