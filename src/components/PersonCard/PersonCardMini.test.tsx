import { render } from '@testing-library/react';
import { PersonCardMini } from './PersonCardMini';
import type { Person } from '../../types';

const person: Person = {
  id: 'p1',
  firstName: 'Jens',
  lastName: 'Mueller',
  birthName: null,
  birthDate: '1990-03-15',
  birthPlace: 'Berlin',
  deathDate: null,
  deathPlace: null,
  gender: 'male',
  occupation: 'Engineer',
  photos: [],
  stories: [],
  contactInfo: null,
  familySide: 'jens',
};

const deceasedPerson: Person = {
  id: 'p2',
  firstName: 'Oma',
  lastName: 'Schmidt',
  birthName: 'Weber',
  birthDate: '1930-06-20',
  birthPlace: 'Hamburg',
  deathDate: '2010-12-01',
  deathPlace: 'Berlin',
  gender: 'female',
  occupation: 'Teacher',
  photos: [],
  stories: [],
  contactInfo: null,
  familySide: 'klara',
};

describe('PersonCardMini', () => {
  const renderCard = (p: Person) =>
    render(
      <svg>
        <PersonCardMini person={p} x={0} y={0} onClick={() => {}} />
      </svg>,
    );

  it('renders the first name', () => {
    const { container } = renderCard(person);
    const texts = Array.from(container.querySelectorAll('text'));
    const hasFirstName = texts.some(t => t.textContent?.includes('Jens'));
    expect(hasFirstName).toBe(true);
  });

  it('renders the initials', () => {
    const { container } = renderCard(person);
    const texts = Array.from(container.querySelectorAll('text'));
    const hasInitials = texts.some(t => t.textContent === 'JM');
    expect(hasInitials).toBe(true);
  });

  it('renders the birth year', () => {
    const { container } = renderCard(person);
    const texts = Array.from(container.querySelectorAll('text'));
    const hasBirthYear = texts.some(t => t.textContent?.includes('1990'));
    expect(hasBirthYear).toBe(true);
  });

  it('renders birth and death years for deceased person', () => {
    const { container } = renderCard(deceasedPerson);
    const texts = Array.from(container.querySelectorAll('text'));
    const hasYears = texts.some(t => t.textContent?.includes('1930') && t.textContent?.includes('2010'));
    expect(hasYears).toBe(true);
  });

  it('renders the first name for deceased person', () => {
    const { container } = renderCard(deceasedPerson);
    const texts = Array.from(container.querySelectorAll('text'));
    const hasName = texts.some(t => t.textContent?.includes('Oma'));
    expect(hasName).toBe(true);
  });
});
