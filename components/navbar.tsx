'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Layers, FolderOpen, HardHat } from 'lucide-react'
import clsx from 'clsx'

const links = [
  { href: '/catalogo',  label: 'Catálogo',  icon: BookOpen  },
  { href: '/apus',      label: 'APUs',       icon: Layers    },
  { href: '/proyectos', label: 'Proyectos',  icon: FolderOpen },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 h-14">
        <Link href="/catalogo" className="flex items-center gap-2 text-blue-700 font-bold text-lg">
          <HardHat className="h-5 w-5" />
          APU ZENTOR
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                pathname.startsWith(href)
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
