import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider, useToast } from './Toast';

// Test component that uses useToast
function TestComponent() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Success message')}>Success</button>
      <button onClick={() => toast.error('Error message')}>Error</button>
      <button onClick={() => toast.info('Info message')}>Info</button>
      <button onClick={() => toast.warning('Warning message')}>Warning</button>
      <button onClick={() => toast.addToast('success', 'Custom', 1000)}>Custom</button>
      <button onClick={() => toast.removeToast('test-id')}>Remove</button>
    </div>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders ToastProvider', () => {
    render(
      <ToastProvider>
        <div>Test</div>
      </ToastProvider>
    );
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('shows success toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Success'));
    // Toast should appear immediately (synchronous state update)
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('shows error toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Error'));
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('shows info toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Info'));
    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('shows warning toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Warning'));
    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('removes toast when close button clicked', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Success'));
    const toastMessage = screen.getByText('Success message');
    expect(toastMessage).toBeInTheDocument();

    // Find close button in the toast container (not in TestComponent)
    const toastContainer = toastMessage.closest('div');
    const closeButton = toastContainer?.querySelector('button');
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(screen.queryByText('Success message')).not.toBeInTheDocument();
    }
  });

  it('auto-removes toast after duration', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText('Custom'));
    });
    
    // Find toast message (not the button)
    const toastMessages = screen.getAllByText('Custom');
    const toastMessage = toastMessages.find(msg => 
      msg.tagName === 'P' || msg.closest('div')?.classList.contains('rounded-lg')
    );
    expect(toastMessage).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    // Check that toast message is gone (button should still be there)
    const remainingMessages = screen.queryAllByText('Custom');
    expect(remainingMessages.length).toBeLessThanOrEqual(1); // Only button remains
  });

  it('throws error when useToast used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useToast must be used within ToastProvider');
    
    consoleError.mockRestore();
  });
});

