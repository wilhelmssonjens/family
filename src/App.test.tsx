import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import type { Person } from './types';

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
    id: 'jens',
    firstName: 'Jens',
    lastName: 'Test',
    birthName: null,
    birthDate: '1990-01-01',
    birthPlace: 'Berlin',
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

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
        json: () => Promise.resolve([]),
      } as Response);
    });
  });

  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });

  it('renders the header', () => {
    render(<App />);
    const header = document.querySelector('header') ?? screen.queryByRole('banner');
    expect(header).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<App />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the focused view on root route', async () => {
    render(<App />);
    await waitFor(
      () => {
        // FocusedTreeView renders person name as text
        expect(screen.getByText('Jens')).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });
});
