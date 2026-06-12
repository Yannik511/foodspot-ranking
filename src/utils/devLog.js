// Dev-only logging. Strips in production builds so verbose breadcrumbs
// don't pollute the device console or leak IDs.
// Use this for debug breadcrumbs; keep console.error / console.warn
// for real problems that should surface in production too.

const isDev = import.meta.env.DEV

export const devLog = isDev ? (...args) => console.log(...args) : () => {}
export const devWarn = isDev ? (...args) => console.warn(...args) : () => {}
