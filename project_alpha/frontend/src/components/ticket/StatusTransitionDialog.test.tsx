import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StatusTransitionDialog } from './StatusTransitionDialog';

describe('StatusTransitionDialog', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <StatusTransitionDialog
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        targetStatus="completed"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open', () => {
    render(
      <StatusTransitionDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        targetStatus="in_progress"
      />
    );
    expect(screen.getByText('切换为处理中')).toBeInTheDocument();
  });

  it('shows resolution input for completed status', () => {
    render(
      <StatusTransitionDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        targetStatus="completed"
      />
    );
    expect(screen.getByText('完成票据')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入处理结果...')).toBeInTheDocument();
  });

  it('shows optional resolution for cancelled status', () => {
    render(
      <StatusTransitionDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        targetStatus="cancelled"
      />
    );
    expect(screen.getByText(/确定要取消这个票据吗/)).toBeInTheDocument();
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    render(
      <StatusTransitionDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        targetStatus="in_progress"
      />
    );
    fireEvent.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm clicked', () => {
    const onConfirm = vi.fn();
    render(
      <StatusTransitionDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        targetStatus="in_progress"
      />
    );
    fireEvent.click(screen.getByText('确认'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('requires resolution for completed status', () => {
    const onConfirm = vi.fn();
    render(
      <StatusTransitionDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        targetStatus="completed"
      />
    );
    
    const confirmButton = screen.getByText('确认');
    expect(confirmButton).toBeDisabled();
    
    fireEvent.change(screen.getByPlaceholderText('请输入处理结果...'), {
      target: { value: '已修复' },
    });
    expect(confirmButton).not.toBeDisabled();
  });

  it('disables confirm when loading', () => {
    render(
      <StatusTransitionDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        targetStatus="in_progress"
        isLoading
      />
    );
    expect(screen.getByText('处理中...')).toBeInTheDocument();
  });
});

