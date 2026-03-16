import { render } from '@testing-library/react';
import { TreeView } from './TreeView';
import type { Person, Relationship } from '../../types';

// Mock d3-zoom to avoid jsdom SVG limitations
vi.mock('d3-zoom', () => ({
  zoom: () => {
    const zoomBehavior: any = () => {};
    zoomBehavior.scaleExtent = () => zoomBehavior;
    zoomBehavior.filter = () => zoomBehavior;
    zoomBehavior.on = () => zoomBehavior;
    zoomBehavior.transform = () => zoomBehavior;
    return zoomBehavior;
  },
  zoomIdentity: {
    translate: () => ({
      scale: () => ({ x: 0, y: 0, k: 1 }),
    }),
  },
}));

// Mock d3-selection to avoid jsdom issues
vi.mock('d3-selection', () => ({
  select: () => {
    const selection: any = () => {};
    selection.call = () => selection;
    selection.on = () => selection;
    return selection;
  },
}));

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
  {
    id: 'p2',
    firstName: 'Klara',
    lastName: 'Test',
    birthName: 'Schmidt',
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
];

const mockRelationships: Relationship[] = [
  { type: 'partner', from: 'p1', to: 'p2', status: 'current' },
];

describe('TreeView', () => {
  const renderTreeView = () =>
    render(
      <TreeView
        persons={mockPersons}
        relationships={mockRelationships}
        centerId="p1"
        onPersonClick={() => {}}
        expandedPersonId={null}
      />,
    );

  it('renders the tree view container', () => {
    const { container } = renderTreeView();
    expect(container.firstChild).toBeTruthy();
  });

  it('renders an SVG element', () => {
    const { container } = renderTreeView();
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders inside a wrapping div', () => {
    const { container } = renderTreeView();
    const div = container.querySelector('div');
    expect(div).toBeTruthy();
    const svg = div?.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders person names in text elements', () => {
    const { container } = renderTreeView();
    const texts = Array.from(container.querySelectorAll('text'));
    const hasJens = texts.some(t => t.textContent?.includes('Jens'));
    expect(hasJens).toBe(true);
  });
});
