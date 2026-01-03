import { useState } from 'react';
import type { Tag } from '@/types';
import { TagBadge } from './TagBadge';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagSelectorProps {
  tags: Tag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TagSelector({
  tags,
  selectedIds,
  onChange,
  placeholder = '选择标签...',
  disabled,
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedTags = tags.filter((t) => selectedIds.includes(t.id));
  const filteredTags = tags.filter(
    (t) => t.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleTag = (tagId: string) => {
    if (selectedIds.includes(tagId)) {
      onChange(selectedIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedIds, tagId]);
    }
  };

  const removeTag = (tagId: string) => {
    onChange(selectedIds.filter((id) => id !== tagId));
  };

  return (
    <div className="relative">
      {/* Selected tags display */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'min-h-[42px] px-3 py-2 border border-gray-300 rounded-lg cursor-pointer flex flex-wrap items-center gap-2',
          disabled && 'bg-gray-100 cursor-not-allowed',
          isOpen && 'ring-2 ring-[#FFD93D] border-[#FFD93D]'
        )}
      >
        {selectedTags.length > 0 ? (
          selectedTags.map((tag) => (
            <TagBadge
              key={tag.id}
              tag={tag}
              onRemove={disabled ? undefined : () => removeTag(tag.id)}
            />
          ))
        ) : (
          <span className="text-gray-400 text-sm">{placeholder}</span>
        )}
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-400 ml-auto transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索标签..."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#FFD93D] focus:border-[#FFD93D] outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Tag list */}
            <div className="overflow-y-auto max-h-48">
              {filteredTags.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                  {search ? '没有匹配的标签' : '暂无标签'}
                </div>
              ) : (
                filteredTags.map((tag) => {
                  const isSelected = selectedIds.includes(tag.id);
                  return (
                    <div
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50',
                        isSelected && 'bg-amber-50'
                      )}
                    >
                      <div
                        className={cn(
                          'w-4 h-4 border rounded flex items-center justify-center',
                          isSelected ? 'bg-[#FFD93D] border-[#FFD93D]' : 'border-gray-300'
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 text-[#1E3A5F]" />}
                      </div>
                      <TagBadge tag={tag} />
                      {tag.is_predefined && (
                        <span className="text-xs text-gray-400 ml-auto">预设</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
