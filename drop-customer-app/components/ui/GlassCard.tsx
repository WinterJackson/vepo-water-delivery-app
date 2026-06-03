import React from 'react';
import { View, ViewProps } from 'react-native';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
  darkTheme?: boolean;
}

export default function GlassCard({ children, className = '', darkTheme = false, ...props }: GlassCardProps) {
  return (
    <View
      className={`rounded-[32px] p-6 shadow-md ${
        darkTheme 
          ? "bg-surface-container border border-outline-variant/20" 
          : "bg-white border border-gray-100"
      } ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
