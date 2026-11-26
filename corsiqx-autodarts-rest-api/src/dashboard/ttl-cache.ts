/**
 * Small in-memory cache with in-flight de-duplication, so several browser tabs and polls
 * cause one upstream call per key and period. Failed loads are not cached.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string, load: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return Promise.resolve(entry.value);
    }
    const running = this.inFlight.get(key);
    if (running) {
      return running;
    }
    const promise = load()
      .then((value) => {
        this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        return value;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }
}
