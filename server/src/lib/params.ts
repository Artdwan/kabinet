// Express 5's ParamsDictionary types values as `string | string[]` (to allow
// repeated path segments). Every route here uses single named params, so
// this just narrows back to plain strings at the call site.
export function pstr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

/**
 * multer/busboy decode multipart filenames as latin1, so a Cyrillic name like
 * «чек-август.png» arrives double-encoded. Re-read the bytes as UTF-8.
 */
export function uploadName(originalname: string): string {
  return Buffer.from(originalname, "latin1").toString("utf8");
}
