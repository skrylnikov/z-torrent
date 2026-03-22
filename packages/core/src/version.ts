import pkg from '../package.json' with { type: 'json' }

export const VERSION = pkg.version as string

/** Short semver fragment for `createdBy` / peer-id prefix (from core package version). */
export const VERSION_STR = VERSION.replace(/\d*./g, (v: string) =>
  `0${parseInt(v, 10) % 100}`.slice(-2)
).slice(0, 4)
