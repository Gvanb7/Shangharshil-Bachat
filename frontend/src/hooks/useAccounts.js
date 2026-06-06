import { useEffect, useState } from 'react'
import api from '../lib/api'

export default function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    let mounted = true
    api.get('/accounts/')
      .then(res => {
        if (mounted) setAccounts(res.data)
      })
      .catch(() => {
        if (mounted) setAccounts([])
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  return { accounts, loading }
}