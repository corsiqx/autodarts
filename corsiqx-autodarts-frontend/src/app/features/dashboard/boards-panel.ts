import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { BoardAction, DashboardBoard } from '../../core/autodarts/dashboard.model';
import { DashboardStore } from '../../core/autodarts/dashboard.store';

interface ActionButton {
  action: BoardAction;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-boards-panel',
  host: { class: 'block' },
  templateUrl: './boards-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardsPanel {
  readonly userId = input.required<string>();
  protected readonly store = inject(DashboardStore);

  protected readonly actions: ActionButton[] = [
    { action: 'start', label: 'Starten', icon: 'ph-play' },
    { action: 'stop', label: 'Stoppen', icon: 'ph-stop' },
    { action: 'reset', label: 'Reset', icon: 'ph-arrow-counter-clockwise' },
  ];

  protected statusText(board: DashboardBoard): string {
    if (!board.connected) return 'Offline';
    return board.event ?? board.status ?? 'Online';
  }

  protected run(board: DashboardBoard, action: BoardAction): void {
    void this.store.runBoardAction(this.userId(), board.id, action);
  }

  protected retry(): void {
    void this.store.loadBoards(this.userId());
  }
}
