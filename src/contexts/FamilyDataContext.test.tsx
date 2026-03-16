import { render, screen, waitFor } from '@testing-library/react';
import { FamilyDataProvider, useFamilyData } from './FamilyDataContext';
import type { Person, Relationship } from '../types';

const mockPersons: Person[] = [
  {
    id: 'p1',
    firstName: 'Jens',
    lastName: 'Test',
    birthName: null,
    birthDate: '1990-01-01',
    birthPlace: 'Berlin',
    deathDate: null,
    deathPlace: null,
    gender: 'male',
    occupation: 'Developer',
    photos: [],
    stories: [],
    contactInfo: null,
    familySide: 'jens',
  },
];

const mockRelationships: Relationship[] = [
  { type: 'partner', from: 'p1', to: 'p2', status: 'current' },
];

function TestConsumer() {
  const { persons, relationships, loading, error } = useFamilyData();
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return (
    <div>
      <span data-testid="person-count">{persons.length}</span>
      <span data-testid="relationship-count">{relationships.length}</span>
      {persons.map((p) => (
        <span key={p.id} data-testid={`person-${p.id}`}>
          {p.firstName}
        </span>
      ))}
    </div>
  );
}

describe('FamilyDataContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state initially', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(() => {}),
    );
    render(
      <FamilyDataProvider>
        <TestConsumer />
      </FamilyDataProvider>,
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('loads and provides person data', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const urlStr = typeof url === 'string' ? url : (url as Request).url;
      if (urlStr.includes('persons')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPersons),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockRelationships),
      } as Response);
    });

    render(
      <FamilyDataProvider>
        <TestConsumer />
      </FamilyDataProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('person-count')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('relationship-count')).toHaveTextContent('1');
    expect(screen.getByTestId('person-p1')).toHaveTextContent('Jens');
  });

  it('shows error on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    render(
      <FamilyDataProvider>
        <TestConsumer />
      </FamilyDataProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });

  it('shows error on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({}),
    } as Response);

    render(
      <FamilyDataProvider>
        <TestConsumer />
      </FamilyDataProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });
});
