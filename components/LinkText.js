import React from 'react';
import { Pressable, Text, Platform, StyleSheet } from 'react-native';

/**
 * LinkText
 * A reusable inline link component with:
 * - Accent color by default (#4ECDC4)
 * - Press & hover feedback (underline + slight opacity)
 * - Variants for future extensibility
 *
 * Props:
 *  - children: node/text
 *  - onPress: function
 *  - variant: 'accent' | 'subtle' | 'danger'
 *  - size: number (font size override)
 *  - style: additional style overrides
 *  - accessibilityLabel: optional custom label
 */
export default function LinkText({
  children,
  onPress,
  variant = 'accent',
  size,
  style,
  accessibilityLabel
}) {
  const colorMap = {
    accent: '#4ECDC4',
    subtle: 'rgba(255,255,255,0.75)',
    danger: '#FF6B6B'
  };

  const baseColor = colorMap[variant] || colorMap.accent;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (typeof children === 'string' ? children : 'link')}
      style={({ pressed, hovered }) => {
        const isWeb = Platform.OS === 'web';
        return [
          styles.base,
          {
            opacity: pressed ? 0.65 : 1,
          },
          (pressed || (isWeb && hovered)) && styles.underlineWrapper,
          style
        ];
      }}
    >
      {({ pressed, hovered }) => {
        const isWeb = Platform.OS === 'web';
        const active = pressed || (isWeb && hovered);
        return (
          <Text
            style={[
              styles.text,
              { color: baseColor },
              size && { fontSize: size },
              active && styles.underlineText
            ]}
          >
            {children}
          </Text>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start'
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3
  },
  underlineText: {
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255,255,255,0.85)'
  },
  underlineWrapper: {
    // Extra placeholder if wrapper-specific styling is needed later
  }
});