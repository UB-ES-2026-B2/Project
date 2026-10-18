import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.jsx';

describe('initial screen', () => {
  it('shows the Barcelona homes heading', () => {
    render(<App />);

    expect(screen.getByText('HOGARES EN BARCELONA')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Encuentra tu próximo hogar' })).toBeInTheDocument();
  });
});
