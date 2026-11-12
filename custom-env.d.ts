declare module 'custom-env' {
  export function env(envName?: string, path?: string): void
  export function env(override: true): void
}
