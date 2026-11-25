import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { CreateUserError, CreateUserPayload, UserSummary } from './user.model';
import { UsersApiService } from './users-api.service';

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface UsersState {
  users: UserSummary[];
  status: LoadStatus;
  loadError: string | null;
  selectedId: string | null;
  creating: boolean;
  createError: CreateUserError | null;
}

const initialState: UsersState = {
  users: [],
  status: 'idle',
  loadError: null,
  selectedId: null,
  creating: false,
  createError: null,
};

const byName = (a: UserSummary, b: UserSummary) =>
  a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });

function toCreateError(error: unknown): CreateUserError {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return { field: null, message: 'Server nicht erreichbar. Prüfe deine Verbindung.' };
    }
    if (error.status === 409) {
      return { field: 'email', message: 'Diese E-Mail ist bereits registriert.' };
    }
    if (error.status === 400) {
      return { field: null, message: 'Bitte prüfe deine Eingaben.' };
    }
  }
  return { field: null, message: 'Account konnte nicht angelegt werden. Versuch es noch einmal.' };
}

export const UsersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ users, selectedId, status }) => ({
    selectedUser: computed(() => users().find((user) => user.id === selectedId()) ?? null),
    isEmpty: computed(() => status() === 'loaded' && users().length === 0),
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

    select(id: string): void {
      patchState(store, { selectedId: store.selectedId() === id ? null : id });
    },

    /** Creates a user, adds it to the list and selects it. Resolves to true on success. */
    async create(payload: CreateUserPayload): Promise<boolean> {
      patchState(store, { creating: true, createError: null });
      try {
        const user = await firstValueFrom(api.create(payload));
        patchState(store, {
          users: [...store.users(), user].sort(byName),
          status: 'loaded',
          selectedId: user.id,
          creating: false,
        });
        return true;
      } catch (error) {
        patchState(store, { creating: false, createError: toCreateError(error) });
        return false;
      }
    },

    clearCreateError(): void {
      patchState(store, { createError: null });
    },
  })),
);
