import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GalleryView } from './GalleryView';
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
    photos: ['/photos/jens1.jpg', '/photos/jens2.jpg'],
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
    photos: ['/photos/klara1.jpg'],
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
    deathDate: null,
    deathPlace: null,
    gender: 'male',
    occupation: null,
    photos: [],
    stories: [],
    contactInfo: null,
    familySide: 'jens',
  },
];

describe('GalleryView', () => {
  const renderGallery = () =>
    render(
      <MemoryRouter>
        <GalleryView persons={mockPersons} />
      </MemoryRouter>,
    );

  it('renders photos as images', () => {
    const { container } = renderGallery();
    const images = container.querySelectorAll('img');
    expect(images.length).toBeGreaterThanOrEqual(1);
  });

  it('renders photos from multiple persons', () => {
    const { container } = renderGallery();
    const images = container.querySelectorAll('img');
    // Jens has 2 photos, Klara has 1 = at least 3
    expect(images.length).toBeGreaterThanOrEqual(3);
  });

  it('renders photo sources correctly', () => {
    const { container } = renderGallery();
    const images = container.querySelectorAll('img');
    const srcs = Array.from(images).map((img) => img.getAttribute('src'));
    expect(srcs.some((s) => s?.includes('jens'))).toBe(true);
    expect(srcs.some((s) => s?.includes('klara'))).toBe(true);
  });

  it('renders filter buttons', () => {
    renderGallery();
    expect(screen.getByText('Alla')).toBeInTheDocument();
    expect(screen.getByText('Jens sida')).toBeInTheDocument();
    expect(screen.getByText('Klaras sida')).toBeInTheDocument();
  });

  it('allows filtering by family side', () => {
    const { container } = renderGallery();

    // Click on "Jens sida" filter
    const jensButton = screen.getByText('Jens sida');
    fireEvent.click(jensButton);

    // After filtering, should still show Jens photos
    const images = container.querySelectorAll('img');
    expect(images.length).toBeGreaterThanOrEqual(1);
    const srcs = Array.from(images).map((img) => img.getAttribute('src'));
    expect(srcs.some((s) => s?.includes('jens'))).toBe(true);
  });
});
