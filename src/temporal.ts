/** Utility methods for Temporal behaviours */
import { Temporal } from "@js-temporal/polyfill";

/**
 * Returns a Date object representing a point in the future.
 * @param duration The duration to offset from the current time.
 * @returns An instant {duration} in the future.
 */
export const future = (duration: Temporal.DurationLike): Temporal.Instant => Temporal.Now.zonedDateTimeISO('UTC').add(duration).toInstant();
export const futureDate = (duration: Temporal.DurationLike): Date => new Date(future(duration).epochMilliseconds);

/**
 * Returns the current time as an epoch timestamp.
 * @returns The current time as an epoch timestamp.
 */
export const now = function (): number {
  return Temporal.Now.instant().epochMilliseconds;
};
