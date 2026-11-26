import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { HomeTournament } from '../../core/autodarts/dashboard.model';
import { DashboardStore } from '../../core/autodarts/dashboard.store';

const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

const MODE_NAMES: Record<string, string> = {
  Straight: 'Single',
  Double: 'Double',
  Master: 'Master',
};

type StateBadge = { label: string; tone: 'registered' | 'open' | 'soon' };

/** Upcoming tournaments the account can enter, as a horizontal card rail. */
@Component({
  selector: 'app-tournaments-panel',
  host: { class: 'block' },
  templateUrl: './tournaments-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentsPanel {
  readonly userId = input.required<string>();
  protected readonly store = inject(DashboardStore);

  /** Ticks every second for the countdowns. */
  protected readonly now = signal(Date.now());

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.now.set(Date.now()));
  }

  protected link(t: HomeTournament): string {
    return `https://play.autodarts.com/tournaments/${encodeURIComponent(t.id)}`;
  }

  protected averageBadge(t: HomeTournament): string | null {
    if (t.minAverage !== null && t.maxAverage !== null) return `Ø ${t.minAverage}–${t.maxAverage}`;
    if (t.maxAverage !== null) return `Ø bis ${t.maxAverage}`;
    if (t.minAverage !== null) return `Ø ab ${t.minAverage}`;
    return null;
  }

  protected state(t: HomeTournament, now: number): StateBadge {
    if (t.registered) return { label: 'Angemeldet', tone: 'registered' };
    const opens = t.registrationOpensAt ? new Date(t.registrationOpensAt).getTime() : 0;
    if (opens > now) return { label: `Anmeldung ab ${time.format(opens)}`, tone: 'soon' };
    return { label: 'Offen', tone: 'open' };
  }

  protected countdown(t: HomeTournament, now: number): string {
    const seconds = Math.max(0, Math.round((new Date(t.startsAt).getTime() - now) / 1000));
    if (seconds === 0) return 'Startet gleich';
    if (seconds >= 3600) return `Beginnt um ${time.format(new Date(t.startsAt))}`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m ? `Beginnt in ${m}m ${s}s` : `Beginnt in ${s}s`;
  }

  protected format(t: HomeTournament): string {
    const parts: string[] = [];
    if (t.baseScore) parts.push(String(t.baseScore));
    if (t.sets) parts.push(`First to ${t.sets} ${t.sets === 1 ? 'Set' : 'Sets'}`);
    else if (t.legs) parts.push(`First to ${t.legs} ${t.legs === 1 ? 'Leg' : 'Legs'}`);
    return parts.join(' · ');
  }

  protected chips(t: HomeTournament): string[] {
    const chips: string[] = [];
    if (t.inMode) chips.push(`${MODE_NAMES[t.inMode] ?? t.inMode} In`);
    if (t.outMode) chips.push(`${MODE_NAMES[t.outMode] ?? t.outMode} Out`);
    if (t.bullOff) chips.push('Bull Off');
    return chips;
  }

  protected reload(): void {
    void this.store.loadTournaments(this.userId());
  }
}
