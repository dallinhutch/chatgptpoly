/** A configured run fails closed when its dates are invalid or its deadline passes. */
export function runActive(now = Date.now()) {
  const end = process.env.RUN_END_AT;
  if (!end) return true;
  const start = Date.parse(process.env.RUN_START_AT ?? "");
  const stop = Date.parse(end);
  return Number.isFinite(start) && Number.isFinite(stop) && now >= start && now < stop;
}
export function assertRunActive() {
  if (!runActive()) throw Error("Paper run is outside its authorized time window");
}
export function researchWindowOpen(now = Date.now()) {
  return runActive(now) && (!process.env.RUN_END_AT || Date.parse(process.env.RUN_END_AT) - now > 600000);
}
