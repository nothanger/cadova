import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react"
import { cloneElement, isValidElement, type ReactElement } from "react"
import { ChevronDown, FileText, Loader2 } from "lucide-react"

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
  const base = "ui-button disabled:opacity-50 disabled:pointer-events-none"
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-hover",
    secondary: "bg-surface text-ink border border-line-strong hover:bg-background",
    ghost: "text-ink-soft hover:bg-background",
    danger: "bg-danger text-white hover:opacity-90",
  } as const
  return (
    <button
      className={cx(base, variants[variant], className)}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
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
  const base = "ui-button"
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-hover",
    secondary: "bg-surface text-ink border border-line-strong hover:bg-background",
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
      {isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
            "aria-describedby": error || hint ? `${htmlFor}-help` : undefined,
            "aria-invalid": error ? true : undefined,
          })
        : children}
      {hint && !error && (
        <p id={`${htmlFor}-help`} className="text-xs leading-5 text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-help`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

const inputBase = "ui-input"

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputBase, props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={cx(inputBase, "ui-textarea", props.className)} />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cx(
          inputBase,
          "appearance-none cursor-pointer pr-10",
          props.className,
        )}
      />
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-3.5 text-muted"
      />
    </div>
  )
}

export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div>
      <div
        className="data-scroll"
        role="region"
        aria-label="Tableau, défilement horizontal disponible"
        tabIndex={0}
      >
        {children}
      </div>
      <p className="border-t border-line bg-background px-4 py-2 text-xs text-muted sm:hidden">
        Faites défiler pour voir toutes les colonnes.
      </p>
    </div>
  )
}

/* --------------------------------------------------------------- Card */
export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
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
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium",
        statusClass[status],
      )}
    >
      {statusLabel[status]}
    </span>
  )
}

export function FollowUpBadge({ days }: { days?: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">
      À relancer{typeof days === "number" ? ` · ${days} j` : ""}
    </span>
  )
}

export { statusLabel }

/* --------------------------------------------------------------- Spinner + states */
export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-16 text-sm text-muted"
    >
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
      <p role="alert" className="text-sm text-danger">
        {message}
      </p>
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
      <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-background text-muted">
        <FileText size={20} aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </Card>
  )
}
