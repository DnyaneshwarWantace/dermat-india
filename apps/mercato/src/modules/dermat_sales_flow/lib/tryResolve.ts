export function tryResolve<T>(resolve: (name: string) => unknown, name: string): T | undefined {
  try {
    return resolve(name) as T
  } catch {
    return undefined
  }
}
