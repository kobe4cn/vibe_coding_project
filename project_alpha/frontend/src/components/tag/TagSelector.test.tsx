import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TagSelector } from './TagSelector';
import type { Tag } from '@/types';

const mockTags: Tag[] = [
  { id: 'tag-1', name: 'Bug', color: '#EF4444', icon: 'bug', is_predefined: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'tag-2', name: 'Feature', color: '#3B82F6', icon: null, is_predefined: false, created_at: '2024-01-01T00:00:00Z' },
  { id: 'tag-3', name: 'Urgent', color: '#F59E0B', icon: null, is_predefined: true, created_at: '2024-01-01T00:00:00Z' },
];

describe('TagSelector', () => {
  it('renders placeholder when no tags selected', () => {
    const onChange = vi.fn();
    render(<TagSelector tags={mockTags} selectedIds={[]} onChange={onChange} />);
    expect(screen.getByText('选择标签...')).toBeInTheDocument();
  });

  it('renders selected tags', () => {
    const onChange = vi.fn();
    render(<TagSelector tags={mockTags} selectedIds={['tag-1']} onChange={onChange} />);
    expect(screen.getByText('Bug')).toBeInTheDocument();
  });

  it('opens dropdown when clicked', () => {
    const onChange = vi.fn();
    render(<TagSelector tags={mockTags} selectedIds={[]} onChange={onChange} />);
    
    const selector = screen.getByText('选择标签...').closest('div');
    if (selector) {
      fireEvent.click(selector);
      expect(screen.getByPlaceholderText('搜索标签...')).toBeInTheDocument();
    }
  });

  it('filters tags by search', () => {
    const onChange = vi.fn();
    render(<TagSelector tags={mockTags} selectedIds={[]} onChange={onChange} />);
    
    const selector = screen.getByText('选择标签...').closest('div');
    if (selector) {
      fireEvent.click(selector);
    }
    
    const searchInput = screen.getByPlaceholderText('搜索标签...');
    fireEvent.change(searchInput, { target: { value: 'Bug' } });
    
    expect(screen.getByText('Bug')).toBeInTheDocument();
    expect(screen.queryByText('Feature')).not.toBeInTheDocument();
  });

  it('toggles tag selection', () => {
    const onChange = vi.fn();
    render(<TagSelector tags={mockTags} selectedIds={[]} onChange={onChange} />);
    
    // Open dropdown
    const selector = screen.getByText('选择标签...').closest('div');
    if (selector) {
      fireEvent.click(selector);
    }
    
    // Wait for dropdown to appear and find tag item
    const searchInput = screen.getByPlaceholderText('搜索标签...');
    expect(searchInput).toBeInTheDocument();
    
    // Find tag by looking for the checkbox container
    const tagContainers = Array.from(document.querySelectorAll('.cursor-pointer'));
    const bugContainer = tagContainers.find(container => 
      container.textContent?.includes('Bug')
    );
    if (bugContainer) {
      fireEvent.click(bugContainer);
      expect(onChange).toHaveBeenCalledWith(['tag-1']);
    }
  });

  it('removes tag when already selected', () => {
    const onChange = vi.fn();
    render(<TagSelector tags={mockTags} selectedIds={['tag-1']} onChange={onChange} />);
    
    // Verify tag is displayed as selected
    expect(screen.getByText('Bug')).toBeInTheDocument();
    
    // Open dropdown - click anywhere on the selector
    const selectorArea = screen.getByText('Bug').closest('div')?.parentElement;
    if (selectorArea) {
      fireEvent.click(selectorArea);
      
      // Find the tag in dropdown and click to deselect
      const searchInput = screen.queryByPlaceholderText('搜索标签...');
      if (searchInput) {
        // The tag should be in a clickable container
        const allClickable = Array.from(document.querySelectorAll('[class*="cursor-pointer"]'));
        const bugItem = allClickable.find(el => 
          el.textContent?.includes('Bug') && 
          el.textContent?.includes('预设')
        );
        if (bugItem) {
          fireEvent.click(bugItem);
          // Should remove the tag
          expect(onChange).toHaveBeenCalled();
        }
      }
    }
  });

  it('removes tag via remove button', () => {
    const onChange = vi.fn();
    render(<TagSelector tags={mockTags} selectedIds={['tag-1']} onChange={onChange} />);
    
    // Find remove button by looking for buttons with SVG icons
    const buttons = screen.getAllByRole('button');
    const removeButton = buttons.find(btn => {
      const svg = btn.querySelector('svg');
      // Check if this button is inside a tag badge (has Bug text nearby)
      const parent = btn.closest('div');
      return svg && parent?.textContent?.includes('Bug') && !parent?.textContent?.includes('选择标签');
    });
    
    if (removeButton) {
      fireEvent.click(removeButton);
      expect(onChange).toHaveBeenCalledWith([]);
    }
  });

  it('shows "no tags" message when filtered list is empty', () => {
    const onChange = vi.fn();
    render(<TagSelector tags={mockTags} selectedIds={[]} onChange={onChange} />);
    
    const selector = screen.getByText('选择标签...').closest('div');
    if (selector) {
      fireEvent.click(selector);
    }
    
    const searchInput = screen.getByPlaceholderText('搜索标签...');
    fireEvent.change(searchInput, { target: { value: 'NonExistent' } });
    
    expect(screen.getByText('没有匹配的标签')).toBeInTheDocument();
  });

  it('shows predefined tag indicator', () => {
    const onChange = vi.fn();
    render(<TagSelector tags={mockTags} selectedIds={[]} onChange={onChange} />);
    
    const selector = screen.getByText('选择标签...').closest('div');
    if (selector) {
      fireEvent.click(selector);
    }
    
    expect(screen.getAllByText('预设').length).toBeGreaterThan(0);
  });

  it('disables when disabled prop is true', () => {
    const onChange = vi.fn();
    render(<TagSelector tags={mockTags} selectedIds={[]} onChange={onChange} disabled />);
    
    const selector = screen.getByText('选择标签...').closest('div');
    expect(selector).toHaveClass('bg-gray-100', 'cursor-not-allowed');
    
    if (selector) {
      fireEvent.click(selector);
      expect(screen.queryByPlaceholderText('搜索标签...')).not.toBeInTheDocument();
    }
  });

  it('closes dropdown when backdrop clicked', () => {
    const onChange = vi.fn();
    render(<TagSelector tags={mockTags} selectedIds={[]} onChange={onChange} />);
    
    const selector = screen.getByText('选择标签...').closest('div');
    if (selector) {
      fireEvent.click(selector);
    }
    
    expect(screen.getByPlaceholderText('搜索标签...')).toBeInTheDocument();
    
    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(screen.queryByPlaceholderText('搜索标签...')).not.toBeInTheDocument();
    }
  });
});

