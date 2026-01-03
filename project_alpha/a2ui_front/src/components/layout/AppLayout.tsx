/**
 * App Layout - Main layout wrapper with navigation
 */
import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: '/tickets', label: 'Tickets', icon: '📋' },
  { href: '/tags', label: 'Tags', icon: '🏷️' },
];

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="text-2xl">🦆</span>
            <span className="font-bold text-xl text-[#1E3A5F]">Project Alpha</span>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={clsx(
                    'px-4 py-2 rounded-lg font-medium transition-colors',
                    isActive
                      ? 'bg-[#FFD93D] text-[#1E3A5F]'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
