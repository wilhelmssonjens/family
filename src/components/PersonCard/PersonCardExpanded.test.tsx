import { render, screen } from '@testing-library/react';
import { PersonCardExpanded } from './PersonCardExpanded';
import type { Person } from '../../types';

const fullPerson: Person = {
  id: 'p1',
  firstName: 'Jens',
  lastName: 'Mueller',
  birthName: null,
  birthDate: '1990-03-15',
  birthPlace: 'Berlin',
  deathDate: null,
  deathPlace: null,
  gender: 'male',
  occupation: 'Software Engineer',
  photos: ['/photos/jens.jpg'],
  stories: [{ title: 'My Story', text: 'Once upon a time...' }],
  contactInfo: 'jens@example.com',
  familySide: 'jens',
};

const minimalPerson: Person = {
  id: 'p2',
  firstName: 'Anna',
  lastName: 'Test',
  birthName: null,
  birthDate: null,
  birthPlace: null,
  deathDate: null,
  deathPlace: null,
  gender: 'female',
  occupation: null,
  photos: [],
  stories: [],
  contactInfo: null,
  familySide: 'center',
};

const noop = () => {};

describe('PersonCardExpanded', () => {
  const renderCard = (p: Person) =>
    render(
      <PersonCardExpanded person={p} relationLabel="" onClose={noop} onEdit={noop} />,
    );

  it('renders the first name', () => {
    renderCard(fullPerson);
    expect(screen.getByText(/Jens/)).toBeInTheDocument();
  });

  it('renders the last name', () => {
    renderCard(fullPerson);
    expect(screen.getByText(/Mueller/)).toBeInTheDocument();
  });

  it('renders the birth date or year', () => {
    renderCard(fullPerson);
    const dateEl = screen.getByText(/1990/);
    expect(dateEl).toBeInTheDocument();
  });

  it('renders the birth place', () => {
    renderCard(fullPerson);
    expect(screen.getByText(/Berlin/)).toBeInTheDocument();
  });

  it('renders the occupation', () => {
    renderCard(fullPerson);
    expect(screen.getByText(/Software Engineer/)).toBeInTheDocument();
  });

  it('renders stories', () => {
    renderCard(fullPerson);
    expect(screen.getByText(/My Story/)).toBeInTheDocument();
  });

  it('renders photo when available', () => {
    const { container } = renderCard(fullPerson);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute('src')).toContain('jens.jpg');
  });

  it('renders minimal person without errors', () => {
    renderCard(minimalPerson);
    expect(screen.getByText(/Anna/)).toBeInTheDocument();
    expect(screen.getByText(/Test/)).toBeInTheDocument();
  });
});
