import { StartggSet } from '../common/types';

export default function getColor(set: StartggSet) {
  if (set.state === 2) {
    return '#0d8225';
  }
  if (set.state === 6) {
    return '#f9a825';
  }
  return undefined;
}
