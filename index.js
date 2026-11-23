// Host half of @local/hero-decor.
// All behavior lives in the client half (client.js): the home hero is pure
// browser UI, so no host services are needed. This minimal plugin keeps the
// bundle installable; customization values persist in the browser's
// localStorage (see docs/DETAIL.md for the rationale).
export function apply(ctx, config) {
  // Intentionally empty.
}
