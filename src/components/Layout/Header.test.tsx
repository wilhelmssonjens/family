import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from './Header';

describe('Header', () => {
  const renderHeader = () =>
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

  it('renders the header element', () => {
    renderHeader();
    const header = document.querySelector('header') ?? screen.getByRole('banner');
    expect(header).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    renderHeader();
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it('renders a link to the tree view', () => {
    renderHeader();
    const treeLink = screen.getAllByRole('link').find(
      (link) =>
        link.getAttribute('href') === '/' ||
        link.textContent?.toLowerCase().includes('träd'),
    );
    expect(treeLink).toBeDefined();
  });

  it('renders a link to search', () => {
    renderHeader();
    const searchLink = screen.getAllByRole('link').find(
      (link) =>
        link.getAttribute('href')?.includes('sok') ||
        link.textContent?.toLowerCase().includes('sök'),
    );
    expect(searchLink).toBeDefined();
  });

  it('renders a link to gallery', () => {
    renderHeader();
    const galleryLink = screen.getAllByRole('link').find(
      (link) =>
        link.getAttribute('href')?.includes('galleri') ||
        link.textContent?.toLowerCase().includes('galleri'),
    );
    expect(galleryLink).toBeDefined();
  });
});
