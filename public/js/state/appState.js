/** Shared application state (Phase 2+) */
export const appState = {
  user: null,
  currentView: 'overview',
  route: null,
  coinId: null,
};

export function setUser(user) {
  appState.user = user;
}

export function getUser() {
  return appState.user;
}

export function setRoute(route) {
  appState.route = route;
  if (route?.view) appState.currentView = route.view;
  if (route?.params?.id) appState.coinId = route.params.id;
}
