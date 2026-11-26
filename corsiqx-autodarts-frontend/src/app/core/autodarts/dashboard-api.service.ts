import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BoardAction, DashboardBoard, DashboardStats, LiveMatch } from './dashboard.model';

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
}
