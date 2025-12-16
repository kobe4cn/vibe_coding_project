import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TagBadge } from './TagBadge';
import type { Tag } from '@/types';

const mockTag: Tag = {
  id: 'tag-1',
  name: 'Bug',
  color: '#EF4444',
  icon: 'bug',
  is_predefined: true,
  created_at: '2024-01-01T00:00:00Z',
};

describe('TagBadge', () => {
  it('renders tag name correctly', () => {
    render(<TagBadge tag={mockTag} />);
    expect(screen.getByText('Bug')).toBeInTheDocument();
  });

  it('applies tag color as background', () => {
    render(<TagBadge tag={mockTag} />);
    const badge = screen.getByText('Bug');
    expect(badge).toHaveStyle({ color: '#EF4444' });
  });

  it('renders without remove button when onRemove is not provided', () => {
    render(<TagBadge tag={mockTag} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders remove button when onRemove is provided', () => {
    const onRemove = vi.fn();
    render(<TagBadge tag={mockTag} onRemove={onRemove} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn();
    render(<TagBadge tag={mockTag} onRemove={onRemove} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('stops event propagation when remove button is clicked', () => {
    const onRemove = vi.fn();
    const onParentClick = vi.fn();
    
    render(
      <div onClick={onParentClick}>
        <TagBadge tag={mockTag} onRemove={onRemove} />
      </div>
    );
    
    fireEvent.click(screen.getByRole('button'));
    expect(onRemove).toHaveBeenCalled();
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<TagBadge tag={mockTag} className="custom-class" />);
    const badge = screen.getByText('Bug');
    expect(badge).toHaveClass('custom-class');
  });
});

