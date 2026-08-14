// Express 5's ParamsDictionary types values as `string | string[]` (to allow
// repeated path segments). Every route here uses single named params, so
// this just narrows back to plain strings at the call site.
export function pstr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}
