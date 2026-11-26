import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateUserPayload, LoginResult, UserSummary } from './user.model';

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/users`;

  getAll(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(this.baseUrl);
  }

  /** Verifies the credentials with Autodarts, stores the account and returns that login. */
  create(payload: CreateUserPayload): Observable<LoginResult> {
    return this.http.post<LoginResult>(this.baseUrl, payload);
  }

  /** Logs the stored account into Autodarts. */
  login(userId: string): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${this.baseUrl}/${userId}/login`, {});
  }
}
