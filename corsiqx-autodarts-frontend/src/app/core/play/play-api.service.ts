import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BoardCamera, CreateGamePayload, MatchAction, MatchView } from './play.model';

/** Starts and plays games through our API, which talks to the Autodarts game server. */
@Injectable({ providedIn: 'root' })
export class PlayApiService {
  private readonly http = inject(HttpClient);

  private base(userId: string): string {
    return `${environment.apiBaseUrl}/users/${userId}/autodarts/play`;
  }

  private match(userId: string, matchId: string): string {
    return `${this.base(userId)}/${encodeURIComponent(matchId)}`;
  }

  create(userId: string, game: CreateGamePayload): Observable<{ matchId: string }> {
    return this.http.post<{ matchId: string }>(this.base(userId), game);
  }

  state(userId: string, matchId: string): Observable<MatchView> {
    return this.http.get<MatchView>(this.match(userId, matchId));
  }

  /** `at` is the tapped board position; without it the dart counts as typed in. */
  throwDart(
    userId: string,
    matchId: string,
    segment: string,
    at?: { x: number; y: number },
  ): Observable<void> {
    return this.http.post<void>(`${this.match(userId, matchId)}/throws`, { segment, ...at });
  }

  scoreTurn(userId: string, matchId: string, score: number): Observable<void> {
    return this.http.post<void>(`${this.match(userId, matchId)}/turns`, { score });
  }

  action(userId: string, matchId: string, action: MatchAction): Observable<void> {
    return this.http.post<void>(`${this.match(userId, matchId)}/${action}`, {});
  }

  abort(userId: string, matchId: string): Observable<void> {
    return this.http.delete<void>(this.match(userId, matchId));
  }

  camera(userId: string, boardId: string): Observable<BoardCamera> {
    return this.http.get<BoardCamera>(
      `${environment.apiBaseUrl}/users/${userId}/autodarts/boards/${encodeURIComponent(boardId)}/camera`,
    );
  }

  snapshot(userId: string, boardId: string, cam: number): Observable<{ url: string | null }> {
    return this.http.get<{ url: string | null }>(
      `${environment.apiBaseUrl}/users/${userId}/autodarts/boards/${encodeURIComponent(boardId)}/camera/${cam}/snapshot`,
    );
  }

  rematch(userId: string, matchId: string): Observable<{ matchId: string }> {
    return this.http.post<{ matchId: string }>(`${this.match(userId, matchId)}/rematch`, {});
  }
}
