import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { Player } from './room-state.service';

const PLAYERS_FILE = '/assets/playerList/IPL_2025_Players_Updated.xlsx';

@Injectable({ providedIn: 'root' })
export class PlayerDataService {
  private cache: Player[] | null = null;

  // Fetches and parses the Excel file once; returns cached result on subsequent calls.
  // Row 0 is the header — data starts at index 1.
  // Columns: [Team, Player Name, Nationality, Role, Marquee Type, Uncapped, Base Price (₹ Cr), Profile URL, Headshot Image URL, URL Verified]
  async getPlayers(): Promise<Player[]> {
    if (this.cache) return this.cache;

    const res = await fetch(PLAYERS_FILE);
    if (!res.ok) throw new Error(`Failed to load player file (HTTP ${res.status})`);

    const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

    this.cache = rows.slice(1)
      .filter(r => r[1] !== undefined && r[1] !== '')
      .map(r => {
        const headshotUrl = r[8] ? String(r[8]).trim() : undefined;
        return {
          name: String(r[1]).trim(),
          iplTeam: String(r[0]).trim(),
          nationality: String(r[2]).trim(),
          role: String(r[3]).trim(),
          marqueeType: String(r[4]).trim(),
          uncapped: String(r[5]).trim().toLowerCase() === 'yes',
          basePrice: Number(r[6]),
          status: 'pending' as const,
          ...(headshotUrl && !headshotUrl.includes('Default') ? { headshotUrl } : {}),
        };
      });

    return this.cache;
  }
}
