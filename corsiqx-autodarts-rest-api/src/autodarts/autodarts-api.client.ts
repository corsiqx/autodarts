import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  autodartsConsentRequired,
  autodartsUnavailable,
} from './autodarts-errors';
import { AutodartsSessionService } from './autodarts-session.service';

const REQUEST_TIMEOUT_MS = 10_000;

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Calls the (unofficial) Autodarts cloud API as a stored account.
 * Retries once with a renewed token on 401, like the official web app.
 */
@Injectable()
export class AutodartsApiClient {
  private readonly logger = new Logger(AutodartsApiClient.name);
  private readonly baseUrl: string;

  constructor(
    config: ConfigService,
    private readonly sessions: AutodartsSessionService,
  ) {
    this.baseUrl = (
      config.get<string>('AUTODARTS_API_URL') ?? 'https://api.autodarts.com'
    ).replace(/\/+$/, '');
  }

  /** Returns the parsed body, or `null` for 404 and empty answers. */
  async request(
    userId: string,
    method: Method,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    let session = await this.sessions.ensure(userId);
    let response = await this.send(session.accessToken, method, path, body);

    if (response.status === 401) {
      session = await this.sessions.ensure(userId, true);
      response = await this.send(session.accessToken, method, path, body);
    }

    const text = await response.text().catch(() => '');
    const payload = parseBody(text);

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      if (
        response.status === 403 &&
        errorCode(payload) === 'consent_required'
      ) {
        throw autodartsConsentRequired();
      }
      this.logger.warn(
        `Autodarts ${method} ${path} answered ${response.status}`,
      );
      throw autodartsUnavailable();
    }
    return payload;
  }

  get(userId: string, path: string): Promise<unknown> {
    return this.request(userId, 'GET', path);
  }

  private async send(
    token: string,
    method: Method,
    path: string,
    body: unknown,
  ): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(
        `Autodarts ${method} ${path} unreachable: ${(error as Error).message}`,
      );
      throw autodartsUnavailable();
    }
  }
}

function parseBody(text: string): unknown {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text.trim();
  }
}

function errorCode(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = payload.error;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'code' in error) {
      return String(error.code);
    }
  }
  return undefined;
}
