import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiErrorBody } from '../users/user.model';
import {
  BoardAction,
  DashboardBoard,
  DashboardStats,
  HomeFriend,
  HomeOverview,
  HomeTournament,
  LiveMatch,
  Resource,
} from './dashboard.model';
import { DashboardApiService } from './dashboard-api.service';

interface DashboardState {
  boards: Resource<DashboardBoard[]>;
  match: Resource<LiveMatch | null>;
  stats: Resource<DashboardStats>;
  home: Resource<HomeOverview>;
  friends: Resource<HomeFriend[]>;
  tournaments: Resource<HomeTournament[]>;
  /** Running board command per board id. */
  boardActions: Record<string, BoardAction>;
  boardActionError: { boardId: string; message: string } | null;
}

const idle = <T>(): Resource<T> => ({ data: null, status: 'idle', error: null });

const initialState: DashboardState = {
  boards: idle(),
  match: idle(),
  stats: idle(),
  home: idle(),
  friends: idle(),
  tournaments: idle(),
  boardActions: {},
  boardActionError: null,
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'Server nicht erreichbar.';
    }
    const body = (error.error ?? {}) as ApiErrorBody;
    if (typeof body.message === 'string') {
      return body.message;
    }
  }
  return fallback;
}

type ResourceKey = 'boards' | 'match' | 'stats' | 'home' | 'friends' | 'tournaments';

/** Dashboard data of one account. Provided per dashboard page, so it resets on leave. */
export const DashboardStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(DashboardApiService)) => {
    const inFlight = new Set<ResourceKey>();

    /** Loads a panel; repeated (polling) loads keep the old data visible. */
    async function load<K extends ResourceKey>(
      key: K,
      request: Observable<DashboardState[K]['data']>,
      fallback: string,
    ): Promise<void> {
      if (inFlight.has(key)) {
        return;
      }
      inFlight.add(key);
      const current = store[key]();
      if (current.status !== 'loaded') {
        patchState(store, { [key]: { ...current, status: 'loading', error: null } });
      }
      try {
        const data = await firstValueFrom(request);
        patchState(store, { [key]: { data, status: 'loaded', error: null } });
      } catch (error) {
        patchState(store, {
          [key]: { data: store[key]().data, status: 'error', error: errorMessage(error, fallback) },
        });
      } finally {
        inFlight.delete(key);
      }
    }

    return {
      loadBoards(userId: string): Promise<void> {
        return load('boards', api.boards(userId), 'Boards konnten nicht geladen werden.');
      },

      loadMatch(userId: string): Promise<void> {
        return load('match', api.match(userId), 'Match konnte nicht geladen werden.');
      },

      loadStats(userId: string): Promise<void> {
        return load('stats', api.stats(userId), 'Statistik konnte nicht geladen werden.');
      },

      loadHome(userId: string): Promise<void> {
        return load('home', api.home(userId), 'Profil konnte nicht geladen werden.');
      },

      loadFriends(userId: string): Promise<void> {
        return load('friends', api.friends(userId), 'Freunde konnten nicht geladen werden.');
      },

      loadTournaments(userId: string): Promise<void> {
        return load('tournaments', api.tournaments(userId), 'Turniere konnten nicht geladen werden.');
      },

      async runBoardAction(userId: string, boardId: string, action: BoardAction): Promise<void> {
        if (store.boardActions()[boardId]) {
          return;
        }
        patchState(store, {
          boardActions: { ...store.boardActions(), [boardId]: action },
          boardActionError: null,
        });
        try {
          await firstValueFrom(api.boardAction(userId, boardId, action));
        } catch (error) {
          patchState(store, {
            boardActionError: {
              boardId,
              message: errorMessage(error, 'Befehl konnte nicht ausgeführt werden.'),
            },
          });
        } finally {
          const { [boardId]: _done, ...rest } = store.boardActions();
          patchState(store, { boardActions: rest });
        }
        await load('boards', api.boards(userId), 'Boards konnten nicht geladen werden.');
      },
    };
  }),
);
