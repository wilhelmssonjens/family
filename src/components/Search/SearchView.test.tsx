import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchView } from './SearchView';
import type { Person } from '../../types';

const mockPersons: Person[] = [
  {
    id: 'p1',
    firstName: 'Jens',
    lastName: 'Mueller',
    birthName: null,
    birthDate: '1990-01-01',
    birthPlace: 'Berlin',
    deathDate: null,
    deathPlace: null,
    gender: 'male',
    occupation: 'Engineer',
    photos: [],
    stories: [],
    contactInfo: null,
    familySide: 'jens',
  },
  {
    id: 'p2',
    firstName: 'Klara',
    lastName: 'Schmidt',
    birthName: null,
    birthDate: '1992-05-15',
    birthPlace: 'Hamburg',
    deathDate: null,
    deathPlace: null,
    gender: 'female',
    occupation: 'Teacher',
    photos: [],
    stories: [],
    contactInfo: null,
    familySide: 'klara',
  },
  {
    id: 'p3',
    firstName: 'Hans',
    lastName: 'Weber',
    birthName: null,
    birthDate: '1960-11-20',
    birthPlace: 'Munich',
    deathDate: '2020-03-01',
    deathPlace: 'Munich',
    gender: 'male',
    occupation: 'Doctor',
    photos: [],
    stories: [],
    contactInfo: null,
    familySide: 'jens',
  },
];

describe('SearchView', () => {
  const renderSearchView = () =>
    render(
      <MemoryRouter>
        <SearchView persons={mockPersons} />
      </MemoryRouter>,
    );

  it('renders a search input field', () => {
    renderSearchView();
    const searchInput = screen.getByPlaceholderText('Sök på namn, plats, yrke...');
    expect(searchInput).toBeInTheDocument();
  });

  it('shows all persons initially', () => {
    renderSearchView();
    expect(screen.getByText(/Jens/)).toBeInTheDocument();
    expect(screen.getByText(/Klara/)).toBeInTheDocument();
    expect(screen.getByText(/Hans/)).toBeInTheDocument();
  });

  it('filters persons when typing a search query', () => {
    renderSearchView();
    const searchInput = screen.getByPlaceholderText('Sök på namn, plats, yrke...');

    fireEvent.change(searchInput, { target: { value: 'Jens' } });

    expect(screen.getByText(/Jens/)).toBeInTheDocument();
    expect(screen.queryByText(/Hans/)).not.toBeInTheDocument();
  });

  it('shows no results message when nothing matches', () => {
    renderSearchView();
    const searchInput = screen.getByPlaceholderText('Sök på namn, plats, yrke...');

    fireEvent.change(searchInput, { target: { value: 'ZZZZNONEXISTENT' } });

    expect(screen.queryByText(/Jens/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Klara/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hans/)).not.toBeInTheDocument();
  });
});
