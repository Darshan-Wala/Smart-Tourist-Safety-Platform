import { DefaultTheme } from '@react-navigation/native';

export const AppNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0f2027',
    card: '#142F40',
    text: '#ffffff',
    border: 'rgba(255,255,255,0.15)',
    primary: '#4ECDC4'
  }
};