import { type ReactNode } from 'react'

interface SafeAreaProps {
  children: ReactNode
  className?: string
}

export default function SafeArea({ children, className = '' }: SafeAreaProps) {
  return (
    <div
      className={className}
      style={{
        paddingTop: 'var(--safe-area-top)',
        paddingLeft: 'var(--safe-area-left)',
        paddingRight: 'var(--safe-area-right)',
      }}
    >
      {children}
    </div>
  )
}
