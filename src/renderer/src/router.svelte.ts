export type Route =
  | { screen: 'home' }
  | { screen: 'settings' }
  | { screen: 'dashboard'; appPath: string }
  | { screen: 'editor'; appPath: string; versionDir: string }
  | { screen: 'screenshots'; appPath: string }
  | { screen: 'reports'; appPath: string }

let route = $state<Route>({ screen: 'home' })

export function getRoute(): Route {
  return route
}

export function navigate(to: Route): void {
  route = to
}

export function goHome(): void {
  navigate({ screen: 'home' })
}

export function goSettings(): void {
  navigate({ screen: 'settings' })
}

export function goToDashboard(appPath: string): void {
  navigate({ screen: 'dashboard', appPath })
}

export function goToEditor(appPath: string, versionDir: string): void {
  navigate({ screen: 'editor', appPath, versionDir })
}

export function goToScreenshots(appPath: string): void {
  navigate({ screen: 'screenshots', appPath })
}

export function goToReports(appPath: string): void {
  navigate({ screen: 'reports', appPath })
}
