import { StartggSet } from '../common/types';

export const CALLED_COLOR = '#f9a825';
export const STARTED_COLOR = '#0d8225';
export function getColor(set: StartggSet) {
  if (set.state === 2) {
    return STARTED_COLOR;
  }
  if (set.state === 6) {
    return CALLED_COLOR;
  }
  return undefined;
}
