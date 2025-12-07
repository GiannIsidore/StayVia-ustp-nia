import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { colorScheme: deviceScheme, setColorScheme } = useColorScheme();
  const [theme, setThemeState] = useState<ThemeMode>('system');

  // Load theme from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem('themeMode').then((t) => {
      if (t === 'light' || t === 'dark' || t === 'system') {
        setThemeState(t);
      }
    });
  }, []);

  // Apply the theme using NativeWind's setColorScheme
  // When theme is 'system', let NativeWind handle it automatically
  useEffect(() => {
    if (theme === 'system') {
      setColorScheme('system');
    } else {
      setColorScheme(theme);
    }
  }, [theme, setColorScheme]);

  // Calculate effective theme based on user preference (for navigation theme)
  const effectiveTheme: 'light' | 'dark' =
    theme === 'system' ? (deviceScheme === 'dark' ? 'dark' : 'light') : theme;

  // Function to change theme and persist to AsyncStorage
  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    AsyncStorage.setItem('themeMode', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
