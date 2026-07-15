// Minimal token set used by the updated screens

export const colors = {
  bg: '#0A141A',
  primary: '#22D6BD',
};

export const gradients = {
  // Background overlay for readability on top of the 4K image
  backdrop: ['rgba(10,20,26,0.85)', 'rgba(10,20,26,0.65)', 'rgba(10,20,26,0.85)'],

  // CTA and components
  primaryCTA: ['#FF6B6B', '#22D6BD'],   // <-- added (used by Login & Register buttons)
  panic: ['#FF4D4D', '#D91E1E'],
  cardGreen: ['#1DB954', '#29b18d'],
  tileTeal: ['#21D4B4', '#1AAE92'],
  tileOrange: ['#FFB266', '#FF7E5F'],
  tilePurple: ['#A770EF', '#CF8BF3'],
  tileBlue: ['#4DA3FF', '#2E86DE'],
};

export const radii = { xl: 22 };
export const shadows = { medium: { elevation: 8 } };
export const spacing = { md: 14, lg: 18, xl: 24, xxl: 32 };