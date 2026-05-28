import { create } from 'zustand'

// rehydrate immediately when module loads
function getInitialState() {
  try {
    const stored = sessionStorage.getItem('auth')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed?.accessToken) {
        sessionStorage.setItem('access_token',  parsed.accessToken)
        sessionStorage.setItem('refresh_token', parsed.refreshToken || '')
        return {
          user:         parsed.user         || null,
          accessToken:  parsed.accessToken,
          refreshToken: parsed.refreshToken || null,
          isAuth:       true,
        }
      }
    }
  } catch {
    // ignore
  }
  return {
    user:         null,
    accessToken:  null,
    refreshToken: null,
    isAuth:       false,
  }
}

const useAuthStore = create((set, get) => ({
  ...getInitialState(),

  setAuth: (user, accessToken, refreshToken) => {
    sessionStorage.setItem('access_token',  accessToken)
    sessionStorage.setItem('refresh_token', refreshToken)
    sessionStorage.setItem('auth', JSON.stringify({
      user, accessToken, refreshToken
    }))
    set({ user, accessToken, refreshToken, isAuth: true })
  },

  updateUser: (user) => {
    const state = get()
    sessionStorage.setItem('auth', JSON.stringify({
      user,
      accessToken:  state.accessToken,
      refreshToken: state.refreshToken,
    }))
    set({ user })
  },

  logout: () => {
    sessionStorage.removeItem('access_token')
    sessionStorage.removeItem('refresh_token')
    sessionStorage.removeItem('auth')
    set({ user: null, accessToken: null, refreshToken: null, isAuth: false })
  },
}))

export default useAuthStore