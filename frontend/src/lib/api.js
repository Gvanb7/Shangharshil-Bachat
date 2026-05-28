import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// attach token to every request
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// handle token expiry globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (
      error.response?.status === 401 &&
      !original._retry &&
      sessionStorage.getItem('refresh_token')
    ) {
      original._retry = true
      try {
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL}/token/refresh/`,
          { refresh: sessionStorage.getItem('refresh_token') }
        )
        const newAccess = res.data.access
        sessionStorage.setItem('access_token', newAccess)
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      } catch {
        sessionStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api