import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/features/auth/AuthContext"
import { companyMessageError, getCompanyMessages } from "./api"
import type { CompanyMessages } from "./messages"

export function useCompanyMessages(companyId: string) {
  const { user } = useAuth()
  const scope = `${user?.id ?? ""}:${companyId}`
  const request = useRef(0)
  const [state, setState] = useState<{
    scope: string
    data: CompanyMessages | null
    loading: boolean
    error: string
  }>({ scope, data: null, loading: true, error: "" })
  const load = useCallback(async () => {
    const ticket = ++request.current
    setState({ scope, data: null, loading: true, error: "" })
    if (!user || !companyId) {
      setState({ scope, data: null, loading: false, error: "" })
      return
    }
    try {
      const data = await getCompanyMessages(companyId)
      if (ticket === request.current)
        setState({ scope, data, loading: false, error: "" })
    } catch (error) {
      if (ticket === request.current)
        setState({
          scope,
          data: null,
          loading: false,
          error: companyMessageError(
            error,
            "Impossible de charger les modèles de l’entreprise.",
          ),
        })
    }
  }, [companyId, user?.id, scope])
  useEffect(() => {
    void load()
    return () => {
      request.current++
    }
  }, [load])
  return state.scope === scope
    ? { ...state, reload: load }
    : { scope, data: null, loading: true, error: "", reload: load }
}
