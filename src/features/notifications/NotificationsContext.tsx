import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "@/features/auth/AuthContext"
import {
  getUnreadNotificationCount,
  listUnreadNotifications,
  markAllRead as markEveryNotificationRead,
  markOneRead,
  notificationAPIError,
} from "./api"
import type { Notification } from "./types"

interface NotificationsContextValue {
  unread: Notification[]
  unreadCount: number
  loading: boolean
  error: string
  refresh: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

interface NotificationsState {
  userId: string | null
  unread: Notification[]
  unreadCount: number
  loading: boolean
  error: string
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(
  undefined,
)

const emptyState: NotificationsState = {
  userId: null,
  unread: [],
  unreadCount: 0,
  loading: false,
  error: "",
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const identity = useRef<string | null>(userId)
  const identityVersion = useRef(0)
  const refreshRequest = useRef(0)
  const [state, setState] = useState<NotificationsState>(emptyState)

  useLayoutEffect(() => {
    identity.current = userId
    identityVersion.current++
    refreshRequest.current++
    return () => {
      identityVersion.current++
      refreshRequest.current++
    }
  }, [userId])

  const refresh = useCallback(async () => {
    if (authLoading || identity.current !== userId) return
    const request = ++refreshRequest.current
    const scope = identityVersion.current
    if (!userId) {
      setState(emptyState)
      return
    }
    setState((current) => ({
      ...(current.userId === userId ? current : emptyState),
      userId,
      loading: true,
    }))
    try {
      const [unread, unreadCount] = await Promise.all([
        listUnreadNotifications(userId),
        getUnreadNotificationCount(userId),
      ])
      if (
        request !== refreshRequest.current ||
        scope !== identityVersion.current ||
        identity.current !== userId
      ) {
        return
      }
      setState({ userId, unread, unreadCount, loading: false, error: "" })
    } catch (error) {
      if (
        request !== refreshRequest.current ||
        scope !== identityVersion.current ||
        identity.current !== userId
      ) {
        return
      }
      setState((current) => ({
        ...(current.userId === userId ? current : emptyState),
        userId,
        loading: false,
        error: notificationAPIError(error),
      }))
    }
  }, [userId, authLoading])

  useEffect(() => {
    void refresh()
    if (!userId || authLoading) return
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    const timer = window.setInterval(refreshWhenVisible, 30_000)
    window.addEventListener("focus", refreshWhenVisible)
    document.addEventListener("visibilitychange", refreshWhenVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refreshWhenVisible)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
      refreshRequest.current++
    }
  }, [refresh, userId, authLoading])

  const markRead = useCallback(
    async (id: string) => {
      if (!userId || identity.current !== userId) {
        throw new Error("Reconnectez-vous pour continuer.")
      }
      const scope = identityVersion.current
      try {
        await markOneRead(id)
      } catch (error) {
        if (scope === identityVersion.current && identity.current === userId) {
          refreshRequest.current++
          setState((current) => ({
            ...(current.userId === userId ? current : emptyState),
            userId,
            loading: false,
            error: notificationAPIError(
              error,
              "Impossible de marquer cette notification comme lue. Réessayez.",
            ),
          }))
        }
        throw error
      }
      if (scope !== identityVersion.current || identity.current !== userId) return
      refreshRequest.current++
      setState((current) => {
        if (current.userId !== userId) return current
        const wasUnread = current.unread.some((item) => item.id === id)
        return {
          ...current,
          unread: current.unread.filter((item) => item.id !== id),
          unreadCount: Math.max(0, current.unreadCount - (wasUnread ? 1 : 0)),
          error: "",
        }
      })
      await refresh()
    },
    [userId, refresh],
  )

  const markAllRead = useCallback(async () => {
    if (!userId || identity.current !== userId) {
      throw new Error("Reconnectez-vous pour continuer.")
    }
    const scope = identityVersion.current
    try {
      await markEveryNotificationRead(userId)
    } catch (error) {
      if (scope === identityVersion.current && identity.current === userId) {
        refreshRequest.current++
        setState((current) => ({
          ...(current.userId === userId ? current : emptyState),
          userId,
          loading: false,
          error: notificationAPIError(
            error,
            "Impossible de marquer les notifications comme lues. Réessayez.",
          ),
        }))
      }
      throw error
    }
    if (scope !== identityVersion.current || identity.current !== userId) return
    refreshRequest.current++
    setState({ ...emptyState, userId })
    await refresh()
  }, [userId, refresh])

  const visibleState = state.userId === userId ? state : emptyState
  return (
    <NotificationsContext.Provider
      value={{
        unread: visibleState.unread,
        unreadCount: visibleState.unreadCount,
        loading:
          authLoading ||
          Boolean(userId && state.userId !== userId) ||
          visibleState.loading,
        error: visibleState.error,
        refresh,
        markRead,
        markAllRead,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider")
  }
  return context
}
