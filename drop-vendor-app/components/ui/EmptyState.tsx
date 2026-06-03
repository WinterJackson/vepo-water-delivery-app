import React from 'react';
import { View } from 'react-native';
import { DropyScene, DropyMood } from './DropyScene';

interface EmptyStateProps {
  mood?: DropyMood;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export function EmptyState({ mood = 'sad', title, subtitle, ctaLabel, onCtaPress }: EmptyStateProps) {
  return (
    <View className="flex-1 w-full bg-transparent">
      <DropyScene
        mood={mood}
        title={title}
        subtitle={subtitle}
        ctaLabel={ctaLabel}
        onCtaPress={onCtaPress}
      />
    </View>
  );
}
