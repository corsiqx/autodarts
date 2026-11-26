import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ApiErrorBody,
  CreateUserError,
  CreateUserPayload,
  LoginResult,
  UserSummary,
} from './user.model';
import { UsersApiService } from './users-api.service';

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface UsersState {
  users: UserSummary[];
  status: LoadStatus;
  loadError: string | null;
  /** Account currently logging in to Autodarts. */
  loggingInId: string | null;
  /** Last failed login, shown under that account's row. */
  loginError: { userId: string; message: string } | null;
  /** Active Autodarts login. */
  session: LoginResult | null;
  creating: boolean;
  createError: CreateUserError | null;
}

const initialState: UsersState = {
  users: [],
  status: 'idle',
  loadError: null,
  loggingInId: null,
  loginError: null,
  session: null,
  creating: false,
  createError: null,
};

const byName = (a: UserSummary, b: UserSummary) =>
  a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });

/** Active login survives reloads within the tab; never contains tokens. */
const SESSION_KEY = 'corsiqx.session';

function readSession(): LoginResult | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as LoginResult) : null;
  } catch {
    return null;
  }
}

function writeSession(session: LoginResult | null): void {
  try {
    if (session) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Storage blocked: the login just does not survive a reload.
  }
}

const UNREACHABLE = 'Server nicht erreichbar. Prüfe deine Verbindung.';

function apiError(error: unknown): { status: number; code?: string; message?: string } {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: -1 };
  }
  const body = (error.error ?? {}) as ApiErrorBody;
  const message = typeof body.message === 'string' ? body.message : undefined;
  return { status: error.status, code: body.code, message };
}

function toCreateError(error: unknown): CreateUserError {
  const { status, code, message } = apiError(error);
  if (status === 0) {
    return { field: null, message: UNREACHABLE };
  }
  if (code === 'email_taken' || status === 409) {
    return { field: 'email', message: 'Diese E-Mail ist bereits registriert.' };
  }
  if (code === 'autodarts_invalid_credentials') {
    return { field: 'password', message: 'Autodarts hat E-Mail oder Passwort abgelehnt.' };
  }
  if (code?.startsWith('autodarts_') && message) {
    return { field: null, message };
  }
  if (status === 400) {
    return { field: null, message: 'Bitte prüfe deine Eingaben.' };
  }
  return { field: null, message: 'Account konnte nicht angelegt werden. Versuch es noch einmal.' };
}

function toLoginError(error: unknown): string {
  const { status, code, message } = apiError(error);
  if (status === 0) {
    return UNREACHABLE;
  }
  if (code === 'autodarts_invalid_credentials') {
    return 'Autodarts lehnt die gespeicherten Zugangsdaten ab. Wurde das Passwort geändert?';
  }
  return message ?? 'Anmeldung bei Autodarts fehlgeschlagen. Versuch es noch einmal.';
}

export const UsersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ users, status, session }) => ({
    isEmpty: computed(() => status() === 'loaded' && users().length === 0),
    activeUserId: computed(() => session()?.user.id ?? null),
  })),
  withMethods((store, api = inject(UsersApiService)) => ({
    async load(): Promise<void> {
      patchState(store, { status: 'loading', loadError: null });
      try {
        const users = await firstValueFrom(api.getAll());
        patchState(store, { users: [...users].sort(byName), status: 'loaded' });
      } catch {
        patchState(store, {
          status: 'error',
          loadError: 'Accounts konnten nicht geladen werden.',
        });
      }
    },

    /** Logs the account into Autodarts with its stored credentials. */
    async login(userId: string): Promise<void> {
      if (store.loggingInId() || store.session()?.user.id === userId) {
        return;
      }
      patchState(store, { loggingInId: userId, loginError: null });
      try {
        const session = await firstValueFrom(api.login(userId));
        writeSession(session);
        patchState(store, { session, loggingInId: null });
      } catch (error) {
        patchState(store, {
          loggingInId: null,
          loginError: { userId, message: toLoginError(error) },
        });
      }
    },

    /** Creates a user after Autodarts accepted the credentials, then keeps that login. */
    async create(payload: CreateUserPayload): Promise<boolean> {
      patchState(store, { creating: true, createError: null });
      try {
        const session = await firstValueFrom(api.create(payload));
        writeSession(session);
        patchState(store, {
          users: [...store.users(), session.user].sort(byName),
          status: 'loaded',
          session,
          loginError: null,
          creating: false,
        });
        return true;
      } catch (error) {
        patchState(store, { creating: false, createError: toCreateError(error) });
        return false;
      }
    },

    /** Leaves the dashboard login; stored accounts stay. */
    signOut(): void {
      writeSession(null);
      patchState(store, { session: null, loginError: null });
    },

    clearCreateError(): void {
      patchState(store, { createError: null });
    },
  })),
  withHooks({
    onInit(store) {
      const session = readSession();
      if (session) {
        patchState(store, { session });
      }
    },
  }),
);
