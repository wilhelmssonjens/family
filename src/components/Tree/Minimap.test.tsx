import { render } from '@testing-library/react';
import { Minimap } from './Minimap';
import type { LayoutNode } from './TreeLayout';

const makePerson = () => ({
  id: 'x',
  firstName: 'X',
  lastName: 'Y',
  birthName: null,
  birthDate: null,
  birthPlace: null,
  deathDate: null,
  deathPlace: null,
  gender: 'male' as const,
  occupation: null,
  photos: [],
  stories: [],
  contactInfo: null,
  familySide: 'center' as const,
});

const mockNodes: LayoutNode[] = [
  { personId: 'n1', person: makePerson(), x: 0, y: 0, links: [] },
  { personId: 'n2', person: makePerson(), x: 200, y: 0, links: [] },
  { personId: 'n3', person: makePerson(), x: 100, y: 150, links: [] },
];

describe('Minimap', () => {
  it('renders an SVG element', () => {
    const { container } = render(
      <Minimap
        nodes={mockNodes}
        viewportX={-50}
        viewportY={-50}
        viewportWidth={800}
        viewportHeight={600}
        scale={1}
      />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders circle elements for nodes', () => {
    const { container } = render(
      <Minimap
        nodes={mockNodes}
        viewportX={-50}
        viewportY={-50}
        viewportWidth={800}
        viewportHeight={600}
        scale={1}
      />,
    );
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(mockNodes.length);
  });

  it('renders the viewport indicator rect', () => {
    const { container } = render(
      <Minimap
        nodes={mockNodes}
        viewportX={-50}
        viewportY={-50}
        viewportWidth={800}
        viewportHeight={600}
        scale={1}
      />,
    );
    const allRects = container.querySelectorAll('rect');
    expect(allRects.length).toBeGreaterThanOrEqual(1);
    const viewportRect = Array.from(allRects).find(
      (rect) =>
        rect.getAttribute('stroke') ||
        rect.getAttribute('fill') === 'none' ||
        rect.getAttribute('opacity'),
    );
    expect(viewportRect).toBeTruthy();
  });

  it('renders correct number of elements', () => {
    const { container } = render(
      <Minimap
        nodes={mockNodes}
        viewportX={-50}
        viewportY={-50}
        viewportWidth={800}
        viewportHeight={600}
        scale={1}
      />,
    );
    const circles = container.querySelectorAll('circle');
    const rects = container.querySelectorAll('rect');
    // 3 circles for nodes + 1 rect for viewport
    expect(circles.length).toBe(3);
    expect(rects.length).toBe(1);
  });
});
