import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BoardCamera } from '../../core/play/play.model';
import { PlayApiService } from '../../core/play/play-api.service';
import {
  Matrix3,
  correspondences,
  multiply,
  solveHomography,
  toMatrix3d,
} from '../../shared/homography';

/** Cloud pictures: ask for the next one as soon as the last arrived, but never above 30 fps. */
const MIN_FRAME_MS = 1000 / 30;

/** Half the visible width in board units: the board up to the number ring. */
const VIEW_RADIUS = 1.3;

type Source = 'stream' | 'cloud' | 'none';

/**
 * Live picture of one board camera. Prefers the Board Manager's MJPEG stream on the local
 * network (full camera frame rate); falls back to single pictures through the Autodarts cloud.
 */
@Component({
  selector: 'app-board-camera',
  host: {
    class:
      'relative block overflow-hidden rounded-full bg-board shadow-[0_0_0_2px_rgb(86_194_255/0.55),0_0_32px_-6px_rgb(86_194_255/0.6)]',
  },
  template: `
    @let picture = source() === 'stream' ? streamUrl() : source() === 'cloud' ? frame() : null;
    @if (picture) {
      @if (warp(); as w) {
        <!-- Camera pixels → front view of the board, done by the GPU on every frame. -->
        <img
          [src]="picture"
          alt=""
          class="absolute left-0 top-0 max-w-none origin-top-left"
          [style.width.px]="w.width"
          [style.height.px]="w.height"
          [style.transform]="w.transform"
          referrerpolicy="no-referrer"
          (error)="source() === 'stream' && streamFailed()"
        />
      } @else {
        <img
          [src]="picture"
          alt=""
          class="size-full object-cover"
          referrerpolicy="no-referrer"
          (error)="source() === 'stream' && streamFailed()"
        />
      }
    } @else {
      <div class="grid size-full place-items-center p-10 text-center">
        <div class="grid justify-items-center gap-2 text-muted">
          <i class="ph ph-video-camera-slash text-4xl" aria-hidden="true"></i>
          <p class="max-w-[26ch] text-sm">{{ message() }}</p>
        </div>
      </div>
    }
    <span class="pointer-events-none absolute bottom-[8%] left-1/2 -translate-x-1/2 rounded-full bg-board/80 px-2.5 py-1 text-xs font-semibold text-bone">
      Kamera {{ cam() + 1 }}
      @if (source() === 'stream') {
        · Live
      } @else if (source() === 'cloud') {
        · {{ fps() }} fps
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardCameraView {
  readonly userId = input.required<string>();
  readonly camera = input.required<BoardCamera>();
  readonly cam = input(0);

  private readonly api = inject(PlayApiService);
  private readonly destroyed = signal(false);

  protected readonly source = signal<Source>('none');
  protected readonly frame = signal<string | null>(null);
  protected readonly fps = signal(0);
  protected readonly message = signal('Kamera wird verbunden …');

  /** https pages may only load the board through its TLS address. */
  protected readonly streamUrl = computed(() => {
    const camera = this.camera();
    const base = location.protocol === 'https:' ? camera.directUrl : (camera.localUrl ?? camera.directUrl);
    return base ? `${base}/api/streams/cams/${this.cam()}` : null;
  });

  /** Rendered size of the round view, for the warp. */
  private readonly size = signal(0);

  /** Homography from camera pixels to board coordinates, per board and camera. */
  private readonly homography = computed(() => {
    const calibration = this.camera().calibration;
    const cam = calibration?.cams[String(this.cam())];
    if (!calibration || !cam) return null;
    const matrix = solveHomography(correspondences(cam));
    return matrix ? { matrix, width: calibration.width, height: calibration.height } : null;
  });

  /**
   * CSS for the warped picture: board coordinates (radius 1 = outer double wire) are scaled so
   * the number ring fits inside the circle.
   */
  protected readonly warp = computed(() => {
    const h = this.homography();
    const size = this.size();
    if (!h || !size) return null;
    const scale = size / (2 * VIEW_RADIUS);
    const toView: Matrix3 = [scale, 0, size / 2, 0, scale, size / 2, 0, 0, 1];
    return {
      width: h.width,
      height: h.height,
      transform: toMatrix3d(multiply(toView, h.matrix)),
    };
  });

  private loop = 0;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const observer = new ResizeObserver(([entry]) => this.size.set(entry.contentRect.width));
    observer.observe(host);
    inject(DestroyRef).onDestroy(() => observer.disconnect());

    inject(DestroyRef).onDestroy(() => {
      this.destroyed.set(true);
      this.loop++;
    });
    effect(() => {
      // Restart whenever board or camera changes.
      const url = this.streamUrl();
      this.cam();
      untracked(() => {
        this.loop++;
        this.frame.set(null);
        if (url) {
          this.source.set('stream');
        } else {
          void this.startCloud();
        }
      });
    });
  }

  protected streamFailed(): void {
    void this.startCloud();
  }

  private async startCloud(): Promise<void> {
    const loop = ++this.loop;
    this.source.set('cloud');
    let frames = 0;
    let since = performance.now();
    while (loop === this.loop && !this.destroyed()) {
      const started = performance.now();
      try {
        const { url } = await firstValueFrom(
          this.api.snapshot(this.userId(), this.camera().boardId, this.cam()),
        );
        if (!url) throw new Error('no picture');
        await preload(url);
        if (loop !== this.loop) return;
        this.frame.set(url);
        frames++;
      } catch {
        if (loop !== this.loop) return;
        this.source.set('none');
        this.message.set(
          this.camera().connected
            ? 'Kamera liefert gerade kein Bild.'
            : 'Board ist offline. Starte Autodarts auf dem Board-PC.',
        );
        await wait(3000);
        if (loop !== this.loop) return;
        this.source.set('cloud');
        continue;
      }
      const now = performance.now();
      if (now - since >= 1000) {
        this.fps.set(Math.round((frames * 1000) / (now - since)));
        frames = 0;
        since = now;
      }
      await wait(Math.max(0, MIN_FRAME_MS - (now - started)));
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Loads an image fully before it is shown, so frames never flicker. */
function preload(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.referrerPolicy = 'no-referrer';
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('image failed'));
    image.src = url;
  });
}
