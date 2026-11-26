import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Unofficial: Autodarts issues no client_ids to third parties, so this uses the
 * client_id of the official web app, as documented in Winmau-Autodarts-API.md (4.5 c/d).
 */
const CLIENT_ID = 'autodarts-play';
const REQUEST_TIMEOUT_MS = 10_000;

export interface AutodartsTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  userId: string;
  username: string | null;
}

export type AutodartsErrorCode =
  'invalid_credentials' | 'invalid_token' | 'consent_required' | 'unavailable';

export class AutodartsAuthError extends Error {
  constructor(
    readonly code: AutodartsErrorCode,
    readonly upstreamStatus?: number,
  ) {
    super(`Autodarts auth failed: ${code}`);
  }
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

interface ErrorResponse {
  error?: string | { code?: string };
}

@Injectable()
export class AutodartsAuthClient {
  private readonly logger = new Logger(AutodartsAuthClient.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('AUTODARTS_API_URL') ?? 'https://api.autodarts.com'
    ).replace(/\/+$/, '');
  }

  /** POST /auth/v1/login with email and password. */
  login(email: string, password: string): Promise<AutodartsTokens> {
    return this.requestTokens('/auth/v1/login', {
      username: email,
      password,
      client_id: CLIENT_ID,
    });
  }

  /** POST /auth/v1/refresh. The returned refresh token replaces the old one, which is now invalid. */
  refresh(refreshToken: string): Promise<AutodartsTokens> {
    return this.requestTokens('/auth/v1/refresh', {
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    });
  }

  private async requestTokens(
    path: string,
    body: Record<string, string>,
  ): Promise<AutodartsTokens> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(
        `Autodarts ${path} unreachable: ${(error as Error).message}`,
      );
      throw new AutodartsAuthError('unavailable');
    }

    const payload = (await response.json().catch(() => ({}))) as TokenResponse &
      ErrorResponse;

    if (!response.ok) {
      throw new AutodartsAuthError(
        this.errorCode(response.status, payload),
        response.status,
      );
    }
    if (!payload.access_token) {
      this.logger.warn(
        `Autodarts ${path} answered ${response.status} without access_token`,
      );
      throw new AutodartsAuthError('unavailable', response.status);
    }

    const claims = decodeJwtPayload(payload.access_token);
    const expiresInSeconds =
      payload.expires_in ?? (claims.exp ? claims.exp - Date.now() / 1000 : 900);

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token ?? null,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      userId: claims.sub ?? '',
      username: claims.preferred_username ?? claims.name ?? null,
    };
  }

  private errorCode(
    status: number,
    payload: ErrorResponse,
  ): AutodartsErrorCode {
    const code =
      typeof payload.error === 'string' ? payload.error : payload.error?.code;
    if (code === 'invalid_credentials') return 'invalid_credentials';
    if (code === 'invalid_token' || code === 'invalid_grant')
      return 'invalid_token';
    if (code === 'consent_required') return 'consent_required';
    if (status === 401) return 'invalid_credentials';
    return 'unavailable';
  }
}

interface JwtClaims {
  sub?: string;
  preferred_username?: string;
  name?: string;
  exp?: number;
}

/** Reads JWT claims without verifying the signature (Autodarts publishes no working JWKS). */
function decodeJwtPayload(token: string): JwtClaims {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as JwtClaims;
  } catch {
    return {};
  }
}
