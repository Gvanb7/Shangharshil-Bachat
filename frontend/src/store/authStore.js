import { create } from 'zustand'

// rehydrate immediately when module loads
function getInitialState() {
  try {
    const stored = sessionStorage.getItem('auth')

    if (stored) {
      const parsed = JSON.parse(stored)

      if (parsed?.accessToken) {
        sessionStorage.setItem('access_token', parsed.accessToken)
        sessionStorage.setItem('refresh_token', parsed.refreshToken || '')

        return {
          user: parsed.user || null,
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken || null,
          isAuth: true,
          mustChangePassword: parsed.mustChangePassword || false,
        }
      }
    }
  } catch {
    // ignore
  }

  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuth: false,
    mustChangePassword: false,
  }
}

const useAuthStore = create((set, get) => ({
  ...getInitialState(),

  setAuth: (
    user,
    accessToken,
    refreshToken,
    mustChangePassword = false
  ) => {
    sessionStorage.setItem('access_token', accessToken)
    sessionStorage.setItem('refresh_token', refreshToken)

    sessionStorage.setItem(
      'auth',
      JSON.stringify({
        user,
        accessToken,
        refreshToken,
        mustChangePassword,
      })
    )

    set({
      user,
      accessToken,
      refreshToken,
      isAuth: true,
      mustChangePassword,
    })
  },

  clearMustChangePassword: () => {
    const state = get()

    const updatedUser = state.user
      ? { ...state.user, must_change_password: false }
      : null

    sessionStorage.setItem(
      'auth',
      JSON.stringify({
        user: updatedUser,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        mustChangePassword: false,
      })
    )

    set({
      user: updatedUser,
      mustChangePassword: false,
    })
  },

  updateUser: (user) => {
    const state = get()

    sessionStorage.setItem(
      'auth',
      JSON.stringify({
        user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        mustChangePassword: state.mustChangePassword,
      })
    )

    set({ user })
  },

  logout: () => {
    sessionStorage.removeItem('access_token')
    sessionStorage.removeItem('refresh_token')
    sessionStorage.removeItem('auth')

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuth: false,
      mustChangePassword: false,
    })
  },
}))

export default useAuthStore