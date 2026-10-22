import { t } from '@/content/format';
import { messages } from '@/content/messages.fr';

/** Durée lisible pour `{delay}` : « moins d’une minute », « 1 minute », « 12 minutes ». */
export function formatDelay(seconds: number): string {
  const delay = messages.auth.delay;
  if (seconds < 60) return delay.lessThanMinute;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? delay.minuteOne : t(delay.minutes, { count: minutes });
}
