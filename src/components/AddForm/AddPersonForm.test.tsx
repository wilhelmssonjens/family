import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddPersonForm } from './AddPersonForm';

const mockOnSubmit = vi.fn();
const mockOnCancel = vi.fn();

describe('AddPersonForm', () => {
  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnCancel.mockClear();
  });

  const renderForm = () =>
    render(
      <AddPersonForm relationType="parent" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />,
    );

  it('renders the form', () => {
    renderForm();
    // Should have at least first name and last name inputs
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('renders first name input', () => {
    renderForm();
    const firstNameInput = screen.getByPlaceholderText('Förnamn');
    expect(firstNameInput).toBeInTheDocument();
  });

  it('renders last name input', () => {
    renderForm();
    const lastNameInput = screen.getByPlaceholderText('Efternamn');
    expect(lastNameInput).toBeInTheDocument();
  });

  it('shows expanded fields when clicking expand button', async () => {
    renderForm();
    const expandButton = screen.getByText('Fler detaljer');
    await userEvent.click(expandButton);

    await waitFor(() => {
      const allInputs = screen.getAllByRole('textbox');
      expect(allInputs.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('has a submit button', () => {
    renderForm();
    const submitButton = screen.getByText('Skicka');
    expect(submitButton).toBeInTheDocument();
  });

  it('submits form with entered data', async () => {
    renderForm();
    const user = userEvent.setup();

    const firstNameInput = screen.getByPlaceholderText('Förnamn');
    const lastNameInput = screen.getByPlaceholderText('Efternamn');

    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Neuer');
    await user.clear(lastNameInput);
    await user.type(lastNameInput, 'Person');

    const submitButton = screen.getByText('Skicka');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });
});
