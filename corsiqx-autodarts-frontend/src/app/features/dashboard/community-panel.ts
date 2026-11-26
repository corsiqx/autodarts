import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FriendStatus, HomeFriend } from '../../core/autodarts/dashboard.model';
import { DashboardStore } from '../../core/autodarts/dashboard.store';
import { Avatar } from '../../shared/avatar';
import { averageTierClasses } from '../../shared/average-tier';
import { Flag } from '../../shared/flag';
import { BoardsPanel } from './boards-panel';

const average = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

interface FriendGroup {
  status: FriendStatus;
  label: string;
  friends: HomeFriend[];
}

const GROUPS: { status: FriendStatus; label: string }[] = [
  { status: 'playing', label: 'Spielt' },
  { status: 'online', label: 'Online' },
  { status: 'offline', label: 'Offline' },
];

/** Sidebar with the account's boards and its friends grouped by what they are doing. */
@Component({
  selector: 'app-community-panel',
  imports: [Avatar, Flag, BoardsPanel],
  host: { class: 'block' },
  templateUrl: './community-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityPanel {
  readonly userId = input.required<string>();
  protected readonly store = inject(DashboardStore);

  protected readonly groups = computed<FriendGroup[]>(() => {
    const friends = this.store.friends().data ?? [];
    return GROUPS.map((group) => ({
      ...group,
      friends: friends.filter((f) => f.status === group.status),
    }));
  });

  protected readonly boardsOnline = computed(
    () => (this.store.boards().data ?? []).filter((b) => b.connected).length,
  );

  protected formatAverage(value: number | null): string {
    return value === null ? '' : `Ø ${average.format(value)}`;
  }

  protected readonly tier = averageTierClasses;

  protected statusLine(friend: HomeFriend): string {
    if (friend.activity) return friend.activity;
    return friend.status === 'online' ? 'Online' : 'Offline';
  }

  protected reloadFriends(): void {
    void this.store.loadFriends(this.userId());
  }
}
