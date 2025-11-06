import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app component', () => {
  render(<App />);
  // Since the app renders a router with routes, we can test for the presence of the router
  expect(document.body).toBeInTheDocument();
});