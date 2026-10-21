'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export function PanelSection({
  title,
  description,
  children,
  actions,
}: {
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section
      className="bf-panel bf-panel--raised"
      style={{
        background: 'var(--color-canvas-white, #ffffff)',
        borderColor: 'var(--color-charcoal-border, #171717)',
      }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className="text-[15px] font-bold"
            style={{ color: 'var(--color-midnight-ink, #000000)', fontFamily: 'var(--font-satoshi)' }}
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-[12px]" style={{ color: 'var(--color-charcoal-border, #171717)', opacity: 0.8 }}>
              {description}
            </p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

export function StatCard({
  label,
  value,
  accent = 'var(--color-midnight-ink, #000000)',
}: {
  label: string
  value: string | number
  accent?: string
}) {
  return (
    <div
      className="bf-card bf-card--raised"
      style={{
        background: 'var(--color-canvas-white, #ffffff)',
        borderColor: 'var(--color-charcoal-border, #171717)',
        boxShadow: 'var(--shadow-subtle)',
      }}
    >
      <div className="text-[26px] font-extrabold" style={{ color: accent, fontFamily: 'var(--font-satoshi)' }}>
        {value}
      </div>
      <div className="mt-1 text-[12px]" style={{ color: 'var(--color-midnight-ink, #000000)', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      className="bf-card bf-card--subtle border-dashed px-4 py-8 text-center text-[13px]"
      style={{ borderColor: 'var(--color-charcoal-border, #171717)', color: 'var(--color-charcoal-border, #171717)', opacity: 0.7 }}
    >
      {children}
    </div>
  )
}

export function Pill({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'blue' | 'green' | 'amber' | 'red'
}) {
  return (
    <span className={`bf-tag ${tone === 'default' ? '' : `bf-tag--${tone}`}`}>
      {children}
    </span>
  )
}

export function ActionButton({
  children,
  onClick,
  disabled,
  tone = 'default',
  type = 'button',
  title,
  ariaLabel,
  iconOnly = false,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  tone?: 'default' | 'primary' | 'danger'
  type?: 'button' | 'submit'
  title?: string
  ariaLabel?: string
  iconOnly?: boolean
  className?: string
}) {
  const toneClass = tone === 'primary' ? 'bf-btn--primary' : tone === 'danger' ? 'bf-btn--danger' : ''

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`bf-btn ${toneClass} ${iconOnly ? 'bf-btn--icon' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

export function DataTable({ children }: { children: ReactNode }) {
  return (
    <div className="bf-card overflow-hidden p-0" style={{ borderColor: 'var(--color-charcoal-border, #171717)' }}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

export type FormSelectOption = { value: string; label: string }

export function FormSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Chọn...',
  className = '',
}: {
  label?: string
  value: string
  options: FormSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find(option => option.value === value)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label ? <label className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--t2)' }}>{label}</label> : null}
      <button
        type="button"
        className={`flex h-10 w-full items-center justify-between border px-3 text-left text-[14px] font-medium outline-none ${open ? 'rounded-t-[4px] rounded-b-none' : 'rounded-[4px]'}`}
        style={{
          borderColor: open ? 'var(--bd)' : 'var(--bds)',
          background: 'var(--bg1)',
          color: selected ? 'var(--t0)' : '#94a3b8',
          boxShadow: 'none',
        }}
        onClick={() => setOpen(v => !v)}
      >
        <span className="min-w-0 truncate">{selected?.label || placeholder}</span>
        <span
          className="ml-2 h-0 w-0 flex-shrink-0"
          style={{
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '6px solid #737373',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>
      {open && (
        <div
          className="bf-scrollbar-none absolute left-0 right-0 top-full z-[90] max-h-56 overflow-y-auto rounded-b-[4px] border border-t-0 p-1"
          style={{ borderColor: 'var(--bd)', background: 'var(--bg1)' }}
        >
          {options.map(option => {
            const isActive = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                className="flex min-h-[38px] w-full items-center rounded-[3px] px-3 text-left text-[13px] font-semibold"
                style={{ background: isActive ? 'var(--color-accent-green)' : 'transparent', color: 'var(--t0)' }}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
