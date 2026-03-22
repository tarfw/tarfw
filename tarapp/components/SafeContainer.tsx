import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SafeContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function SafeContainer({ children, style, edges = ['top', 'bottom'] }: SafeContainerProps) {
  const insets = useSafeAreaInsets();
  
  const edgeStyles: ViewStyle = {};
  
  if (edges.includes('top')) {
    edgeStyles.paddingTop = insets.top;
  }
  if (edges.includes('bottom')) {
    edgeStyles.paddingBottom = insets.bottom;
  }
  if (edges.includes('left')) {
    edgeStyles.paddingLeft = insets.left;
  }
  if (edges.includes('right')) {
    edgeStyles.paddingRight = insets.right;
  }
  
  return (
    <View style={[styles.container, edgeStyles, style]}>
      {children}
    </View>
  );
}

// Convenience component for modals with proper safe areas
export function SafeModalContainer({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.modalContainer, { paddingTop: insets.top }, style]}>
      {children}
    </View>
  );
}

// Convenience component for modal footer with proper bottom safe area
export function SafeModalFooter({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 16) }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
});