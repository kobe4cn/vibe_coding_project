import { useState } from 'react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';

// Common icons for tags
const COMMON_ICONS = [
  'bug', 'sparkles', 'trending-up', 'file-text', 'help-circle',
  'alert-octagon', 'ban', 'monitor', 'server', 'database',
  'webhook', 'palette', 'eye', 'test-tube', 'rocket',
  'pause-circle', 'star', 'flag', 'bookmark', 'tag',
  'folder', 'clock', 'calendar', 'user', 'users',
  'settings', 'wrench', 'zap', 'shield', 'lock',
];

// Convert kebab-case to PascalCase for Lucide icons
const getIconComponent = (iconName: string): React.ElementType | undefined => {
  const pascalCase = iconName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return (Icons as unknown as Record<string, React.ElementType>)[pascalCase];
};

// Pre-create icon component map to avoid creating components during render
const iconComponentMap = new Map<string, React.ElementType>();
COMMON_ICONS.forEach((iconName) => {
  const Icon = getIconComponent(iconName);
  if (Icon) {
    iconComponentMap.set(iconName, Icon);
  }
});


interface IconSelectorProps {
  value?: string;
  onChange: (icon: string | undefined) => void;
  disabled?: boolean;
}

export function IconSelector({ value, onChange, disabled }: IconSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredIcons = COMMON_ICONS.filter((icon) =>
    icon.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 border border-gray-300 rounded-lg flex items-center gap-2 text-left',
          disabled && 'bg-gray-100 cursor-not-allowed',
          isOpen && 'ring-2 ring-blue-500 border-blue-500'
        )}
      >
        {value && iconComponentMap.has(value) ? (
          <>
            {(() => {
              const Icon = iconComponentMap.get(value)!;
              return <Icon className="w-4 h-4" />;
            })()}
            <span className="text-sm">{value}</span>
          </>
        ) : (
          <span className="text-sm text-gray-400">选择图标...</span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
            {/* Search */}
            <div className="p-2 border-b">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索图标..."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Clear option */}
            <div
              onClick={() => {
                onChange(undefined);
                setIsOpen(false);
              }}
              className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer border-b"
            >
              无图标
            </div>

            {/* Icon grid */}
            <div className="p-2 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-6 gap-1">
                {filteredIcons.map((iconName) => {
                  const Icon = iconComponentMap.get(iconName);
                  if (!Icon) return null;
                  const isSelected = value === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => {
                        onChange(iconName);
                        setIsOpen(false);
                      }}
                      title={iconName}
                      className={cn(
                        'p-2 rounded hover:bg-gray-100 flex items-center justify-center',
                        isSelected && 'bg-blue-100 text-blue-600'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

