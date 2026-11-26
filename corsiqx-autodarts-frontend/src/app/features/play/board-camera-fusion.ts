import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { BoardCamera } from '../../core/play/play.model';
import { FusionCamera, fusionMasks } from '../../shared/camera-fusion';
import {
  Matrix3,
  correspondences,
  multiply,
  solveHomography,
  toMatrix3d,
} from '../../shared/homography';

/** Same framing as the single camera view: the board up to the number ring. */
const VIEW_RADIUS = 1.3;

interface Layer {
  cam: number;
  url: string;
  fusion: FusionCamera;
  mask: string;
}

/** All calibrated cameras of a board, straightened and blended into one sharp front view. */
export function canFuse(camera: BoardCamera): boolean {
  const cams = Object.keys(camera.calibration?.cams ?? {}).length;
  return cams >= 2 && !!streamBase(camera);
}

function streamBase(camera: BoardCamera): string | null {
  return location.protocol === 'https:' ? camera.directUrl : (camera.localUrl ?? camera.directUrl);
}

@Component({
  selector: 'app-board-camera-fusion',
  host: {
    class:
      'relative block overflow-hidden rounded-full bg-board shadow-[0_0_0_2px_rgb(86_194_255/0.55),0_0_32px_-6px_rgb(86_194_255/0.6)]',
  },
  template: `
    @for (layer of layers(); track layer.cam) {
      <div
        class="absolute inset-0"
        [style]="loaded()[layer.cam] ? maskStyle(layer.mask) : 'opacity:0'"
      >
        @if (transforms()[layer.cam]; as transform) {
          <img
            [src]="layer.url"
            [attr.data-cam]="layer.cam"
            alt=""
            class="absolute left-0 top-0 max-w-none origin-top-left"
            [style.width.px]="layer.fusion.width"
            [style.height.px]="layer.fusion.height"
            [style.transform]="transform"
            referrerpolicy="no-referrer"
            (load)="markLoaded(layer.cam)"
            (error)="failed.emit()"
          />
        }
      </div>
    }
    <span class="pointer-events-none absolute bottom-[8%] left-1/2 -translate-x-1/2 rounded-full bg-board/80 px-2.5 py-1 text-xs font-semibold text-bone">
      {{ layers().length }} Kameras kombiniert · Live
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardCameraFusion {
  readonly camera = input.required<BoardCamera>();
  /** A stream did not load; the parent switches to a single camera. */
  readonly failed = output<void>();

  private readonly size = signal(0);
  /** The mask is set only after a stream showed its first frame; set earlier, Chromium keeps the layer empty. */
  protected readonly loaded = signal<Record<number, boolean>>({});

  protected markLoaded(cam: number): void {
    if (!this.loaded()[cam]) this.loaded.update((l) => ({ ...l, [cam]: true }));
  }

  protected maskStyle(mask: string): string {
    const url = `url(${mask})`;
    // Own compositing layer: Chromium drops a 3D-transformed child under a mask otherwise.
    return `transform:translateZ(0);overflow:hidden;mask-image:${url};-webkit-mask-image:${url};mask-size:100% 100%;-webkit-mask-size:100% 100%;mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat`;
  }

  /** Homographies and blend masks only change with the calibration. */
  protected readonly layers = computed<Layer[]>(() => {
    const camera = this.camera();
    const calibration = camera.calibration;
    const base = streamBase(camera);
    if (!calibration || !base) return [];
    const cams = Object.entries(calibration.cams)
      .map(([index, cal]) => ({ cam: Number(index), matrix: solveHomography(correspondences(cal)) }))
      .filter((c): c is { cam: number; matrix: Matrix3 } => c.matrix !== null)
      .sort((a, b) => a.cam - b.cam);
    const fusion = cams.map(({ matrix }) => ({
      matrix,
      width: calibration.width,
      height: calibration.height,
    }));
    const masks = fusionMasks(fusion, VIEW_RADIUS);
    if (!masks) return [];
    return cams.map(({ cam }, k) => ({
      cam,
      url: `${base}/api/streams/cams/${cam}`,
      fusion: fusion[k],
      mask: masks[k],
    }));
  });

  protected readonly transforms = computed(() => {
    const size = this.size();
    if (!size) return {} as Record<number, string>;
    const scale = size / (2 * VIEW_RADIUS);
    const toView: Matrix3 = [scale, 0, size / 2, 0, scale, size / 2, 0, 0, 1];
    const result: Record<number, string> = {};
    for (const layer of this.layers()) {
      result[layer.cam] = toMatrix3d(multiply(toView, layer.fusion.matrix));
    }
    return result;
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const observer = new ResizeObserver(([entry]) => this.size.set(entry.contentRect.width));
    observer.observe(host);
    // MJPEG streams do not reliably fire `load`; a picture with a size has its first frame.
    const poll = setInterval(() => {
      host.querySelectorAll<HTMLImageElement>('img[data-cam]').forEach((img) => {
        if (img.naturalWidth > 0) this.markLoaded(Number(img.dataset['cam']));
      });
    }, 150);
    inject(DestroyRef).onDestroy(() => {
      observer.disconnect();
      clearInterval(poll);
    });
  }
}
