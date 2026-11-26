import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MatchDetail, MatchHistory, MatchType, StatVariant, StatsOverview } from './stats.model';

@Injectable({ providedIn: 'root' })
export class StatsApiService {
  private readonly http = inject(HttpClient);

  private base(userId: string): string {
    return `${environment.apiBaseUrl}/users/${userId}/autodarts/stats`;
  }

  overview(userId: string, variant: StatVariant, limit = 100): Observable<StatsOverview> {
    return this.http.get<StatsOverview>(`${this.base(userId)}/overview/${variant}`, {
      params: { limit },
    });
  }

  history(userId: string, page: number, type: MatchType | null): Observable<MatchHistory> {
    let params = new HttpParams().set('page', page);
    if (type) params = params.set('type', type);
    return this.http.get<MatchHistory>(`${this.base(userId)}/matches`, { params });
  }

  match(userId: string, matchId: string): Observable<MatchDetail> {
    return this.http.get<MatchDetail>(`${this.base(userId)}/matches/${encodeURIComponent(matchId)}`);
  }
}
