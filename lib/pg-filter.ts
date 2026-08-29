/**
 * Escaping for values interpolated into a PostgREST `or=(...)` filter.
 *
 * `or()` takes a string, so a search box concatenated into it is an injection
 * point: a comma starts a new condition and the caller gets to add filters of
 * their own. The 2026-08-29 audit turned that into a blind oracle — appending
 * `password.like.$2a$12$K*` made a row come back only when the guess matched
 * the hash prefix, so a viewer could read a deck's bcrypt hash out character by
 * character and crack it offline.
 *
 * Escaping the LIKE wildcards (which the callers already did) does nothing
 * about this: the grammar characters are the problem, and PostgREST has no
 * escape for them inside an unquoted filter value.
 */
export function escapeOrFilterValue(input: string): string {
  return input
    // Grammar characters — dropped, not escaped, because there is nothing to
    // escape them with. A space keeps neighbouring words apart; none of these
    // is meaningful when searching a client or campaign name.
    .replace(/[,()"*\\]/g, ' ')
    // LIKE's own wildcards, so a literal % or _ in a name matches itself.
    .replace(/[%_]/g, c => `\\${c}`)
    .trim()
}
