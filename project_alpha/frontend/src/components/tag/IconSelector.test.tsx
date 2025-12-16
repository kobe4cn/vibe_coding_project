import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IconSelector } from './IconSelector';

describe('IconSelector', () => {
  it('renders placeholder when no value', () => {
    const onChange = vi.fn();
    render(<IconSelector onChange={onChange} />);
    expect(screen.getByText('选择图标...')).toBeInTheDocument();
  });

  it('renders selected icon', () => {
    const onChange = vi.fn();
    render(<IconSelector value="bug" onChange={onChange} />);
    expect(screen.getByText('bug')).toBeInTheDocument();
  });

  it('opens dropdown when clicked', () => {
    const onChange = vi.fn();
    render(<IconSelector onChange={onChange} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(screen.getByPlaceholderText('搜索图标...')).toBeInTheDocument();
  });

  it('filters icons by search', () => {
    const onChange = vi.fn();
    render(<IconSelector onChange={onChange} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    const searchInput = screen.getByPlaceholderText('搜索图标...');
    fireEvent.change(searchInput, { target: { value: 'bug' } });
    
    // Should show bug icon
    expect(screen.getByTitle('bug')).toBeInTheDocument();
  });

  it('calls onChange when icon selected', () => {
    const onChange = vi.fn();
    render(<IconSelector onChange={onChange} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    const bugIcon = screen.getByTitle('bug');
    fireEvent.click(bugIcon);
    
    expect(onChange).toHaveBeenCalledWith('bug');
  });

  it('clears selection when "无图标" clicked', () => {
    const onChange = vi.fn();
    render(<IconSelector value="bug" onChange={onChange} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    const clearOption = screen.getByText('无图标');
    fireEvent.click(clearOption);
    
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('closes dropdown when backdrop clicked', () => {
    const onChange = vi.fn();
    render(<IconSelector onChange={onChange} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(screen.getByPlaceholderText('搜索图标...')).toBeInTheDocument();
    
    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(screen.queryByPlaceholderText('搜索图标...')).not.toBeInTheDocument();
    }
  });

  it('disables when disabled prop is true', () => {
    const onChange = vi.fn();
    render(<IconSelector onChange={onChange} disabled />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    fireEvent.click(button);
    expect(screen.queryByPlaceholderText('搜索图标...')).not.toBeInTheDocument();
  });

  it('highlights selected icon', () => {
    const onChange = vi.fn();
    render(<IconSelector value="bug" onChange={onChange} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    const bugIcon = screen.getByTitle('bug');
    expect(bugIcon).toHaveClass('bg-blue-100', 'text-blue-600');
  });
});

