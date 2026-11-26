import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BoardAction,
  DashboardBoard,
  DashboardStats,
  HomeFriend,
  HomeOverview,
  HomeTournament,
  LiveMatch,
} from './dashboard.model';

/** Autodarts data of a stored account, fetched through our API. */
@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);

  private base(userId: string): string {
    return `${environment.apiBaseUrl}/users/${userId}/autodarts`;
  }

  boards(userId: string): Observable<DashboardBoard[]> {
    return this.http.get<DashboardBoard[]>(`${this.base(userId)}/boards`);
  }

  boardAction(userId: string, boardId: string, action: BoardAction): Observable<void> {
    return this.http.post<void>(
      `${this.base(userId)}/boards/${encodeURIComponent(boardId)}/${action}`,
      {},
    );
  }

  match(userId: string): Observable<LiveMatch | null> {
    return this.http.get<LiveMatch | null>(`${this.base(userId)}/match`);
  }

  stats(userId: string): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.base(userId)}/stats`);
  }

  home(userId: string): Observable<HomeOverview> {
    return this.http.get<HomeOverview>(`${this.base(userId)}/home`);
  }

  friends(userId: string): Observable<HomeFriend[]> {
    return this.http.get<HomeFriend[]>(`${this.base(userId)}/friends`);
  }

  tournaments(userId: string): Observable<HomeTournament[]> {
    return this.http.get<HomeTournament[]>(`${this.base(userId)}/tournaments`);
  }
}
