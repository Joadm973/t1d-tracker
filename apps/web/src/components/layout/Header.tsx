import { type ReactNode } from 'react'
import SafeArea from './SafeArea'

interface HeaderProps {
  title: string
  right?: ReactNode
}

export default function Header({ title, right }: HeaderProps) {
  return (
    <SafeArea>
      <header
        style={{
          backgroundColor: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border)',
        }}
        className="sticky top-0 z-10"
      >
        <div className="flex items-center justify-between px-4 h-14">
          <h1
            className="text-lg font-semibold"
            style={{ color: 'var(--color-text)' }}
          >
            {title}
          </h1>
          {right && <div>{right}</div>}
        </div>
      </header>
    </SafeArea>
  )
}
