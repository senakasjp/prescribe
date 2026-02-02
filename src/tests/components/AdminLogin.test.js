import { render, screen, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import AdminLogin from '../../components/AdminLogin.svelte';
import adminAuthService from '../../services/adminAuthService.js';

// Mock the adminAuthService
vi.mock('../../services/adminAuthService.js', () => ({
  default: {
    signInAdmin: vi.fn(),
  },
}));

describe('AdminLogin.svelte', () => {
  it('renders the login form', () => {
    render(AdminLogin);
    expect(screen.getByLabelText('Admin Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In to Admin Panel' })).toBeInTheDocument();
  });

  it('allows an admin to log in', async () => {
    const user = userEvent.setup();
    const { component } = render(AdminLogin);

    // Create a mock for the event dispatcher
    const mockDispatcher = vi.fn();
    component.$on('admin-signed-in', mockDispatcher);

    // Mock the service call to resolve successfully
    const mockAdminUser = { uid: '123', email: 'admin@test.com' };
    adminAuthService.signInAdmin.mockResolvedValue(mockAdminUser);

    // Find form elements
    const emailInput = screen.getByLabelText('Admin Email');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByRole('button', { name: 'Sign In to Admin Panel' });

    // Simulate user input
    await user.type(emailInput, 'admin@test.com');
    await user.type(passwordInput, 'password123');
    await user.click(loginButton);

    // Assertions
    expect(adminAuthService.signInAdmin).toHaveBeenCalledTimes(1);
    expect(adminAuthService.signInAdmin).toHaveBeenCalledWith('admin@test.com', 'password123');
    
    // Check if the success event was dispatched
    // We need to wait for the promise to resolve in handleSubmit
    await new Promise(resolve => setTimeout(resolve, 0)); 
    expect(mockDispatcher).toHaveBeenCalledTimes(1);
    expect(mockDispatcher).toHaveBeenCalledWith(expect.objectContaining({
      detail: mockAdminUser
    }));
  });

  it('shows an error message on failed login', async () => {
    const user = userEvent.setup();
    render(AdminLogin);

    // Mock the service call to reject with an error
    const errorMessage = 'Invalid credentials';
    adminAuthService.signInAdmin.mockRejectedValue(new Error(errorMessage));

    // Simulate user input and click
    await user.type(screen.getByLabelText('Admin Email'), 'wrong@test.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: 'Sign In to Admin Panel' }));

    // Wait for the error message to appear
    const errorElement = await screen.findByRole('alert');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveTextContent(errorMessage);
  });
});
