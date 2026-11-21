/**
 * Small in-memory token bucket. Good enough for one Node process (Phase 2);
 * Phase 4 adds rate limiting at nginx in front of the app.
 */
export type Bucket = { tokens: number; updatedAt: number };

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    /** Maximum burst. */
    readonly capacity: number,
    /** Tokens added per second. */
    readonly refillPerSecond: number,
    private readonly maxKeys = 10_000,
  ) {}

  /** Takes one token for `key`. Returns false when the caller should be throttled. */
  take(key: string, now = Date.now()): boolean {
    let b = this.buckets.get(key);
    if (!b) {
      if (this.buckets.size >= this.maxKeys) this.evictOldest();
      b = { tokens: this.capacity, updatedAt: now };
      this.buckets.set(key, b);
    }
    const elapsed = Math.max(0, now - b.updatedAt) / 1000;
    b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refillPerSecond);
    b.updatedAt = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  private evictOldest() {
    const first = this.buckets.keys().next();
    if (!first.done) this.buckets.delete(first.value);
  }
}

const globalForLimits = globalThis as unknown as { __nileLimits?: Record<string, RateLimiter> };
const limits = (globalForLimits.__nileLimits ??= {});

/** Checkout submits: burst of 10, then one every 6 seconds, per cart / client. */
export const checkoutLimiter = (limits.checkout ??= new RateLimiter(10, 1 / 6));
/** Webhook deliveries: burst of 60, then 10 per second (global). */
export const webhookLimiter = (limits.webhook ??= new RateLimiter(60, 10));
/** Mock payment buttons: burst of 10, then one every 3 seconds, per client. */
export const mockPayLimiter = (limits.mockPay ??= new RateLimiter(10, 1 / 3));
