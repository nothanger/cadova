import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react"
import { Loader2 } from "lucide-react"

/* Tiny className joiner. */
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ")
}

/* --------------------------------------------------------------- Button */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  loading?: boolean
}
export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[10px] px-4 h-10 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none"
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-hover",
    secondary:
      "bg-surface text-ink border border-line-strong hover:bg-background",
    ghost: "text-ink-soft hover:bg-background",
    danger: "bg-danger text-white hover:opacity-90",
  } as const
  return (
    <button
      className={cx(base, variants[variant], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

/* A Link styled as a button (avoids nesting <button> inside <a>). */
import { Link, type LinkProps } from "react-router-dom"
export function LinkButton({
  variant = "primary",
  className,
  children,
  ...rest
}: LinkProps & { variant?: "primary" | "secondary" | "ghost" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[10px] px-4 h-10 text-sm font-medium transition-colors"
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-hover",
    secondary:
      "bg-surface text-ink border border-line-strong hover:bg-background",
    ghost: "text-ink-soft hover:bg-background",
  } as const
  return (
    <Link className={cx(base, variants[variant], className)} {...rest}>
      {children}
    </Link>
  )
}

/* --------------------------------------------------------------- Fields */
export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

const inputBase =
  "h-10 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputBase, props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        inputBase,
        "h-auto min-h-[88px] py-2 resize-y",
        props.className,
      )}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        inputBase,
        "appearance-none cursor-pointer",
        props.className,
      )}
    />
  )
}

/* --------------------------------------------------------------- Card */
export function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-cadova)] border border-line bg-surface",
        className,
      )}
    >
      {children}
    </div>
  )
}

/* --------------------------------------------------------------- Status badge */
import type { QuoteStatus } from "@/types"

const statusLabel: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  refused: "Refusé",
}
const statusClass: Record<QuoteStatus, string> = {
  draft: "bg-background text-ink-soft border-line-strong",
  sent: "bg-primary-soft text-primary border-primary/20",
  accepted: "bg-success-soft text-success border-success/20",
  refused: "bg-danger-soft text-danger border-danger/20",
}

export function StatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusClass[status],
      )}
    >
      {statusLabel[status]}
    </span>
  )
}

export function FollowUpBadge({ days }: { days?: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">
      À relancer{typeof days === "number" ? ` · ${days} j` : ""}
    </span>
  )
}

export { statusLabel }

/* --------------------------------------------------------------- Spinner + states */
export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Loader2 size={18} className="animate-spin" />
      {label}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <Card className="p-8 text-center">
      <p className="text-sm text-danger">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button variant="secondary" onClick={onRetry}>
            Réessayer
          </Button>
        </div>
      )}
    </Card>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <Card className="flex flex-col items-center gap-3 px-8 py-16 text-center">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </Card>
  )
}
