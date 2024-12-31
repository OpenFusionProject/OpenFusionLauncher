// This file provides a time-based seed that is unique to the launch.
// This can be used to prevent resource caching across launches.

let time_now: number | undefined = undefined;

export default function get_seed() {
  if (time_now === undefined) {
    time_now = Date.now() / 1000;
  }
  return time_now;
}
