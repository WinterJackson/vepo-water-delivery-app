import React, { useEffect, useState, useContext } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { UIThemeContext } from '@/context/ThemeContext';
import { BRAND } from '@/constants/brandColors';

interface SkeletonProps {
  width: number | string;
  height: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

export function Skeleton({
  width,
  height,
  borderRadius = 8,
  style,
  className,
}: SkeletonProps) {
  const { currentTheme } = useContext(UIThemeContext);
  const isDark = currentTheme === 'dark';
  const opacity = useSharedValue(0.3);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(true);
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 800 }),
          withTiming(0.3, { duration: 800 })
        ),
        -1,
        true
      );
    }, 200); // Anti-flash delay

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!show) return null;

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: isDark ? BRAND.gray800 : BRAND.gray200,
        },
        animatedStyle,
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      className={className}
    />
  );
}

// Pre-shaped variants

export function SkeletonText({
  width = '80%',
  style,
  className,
}: { width?: number | string; style?: StyleProp<ViewStyle>; className?: string; }) {
  return <Skeleton width={width} height={16} borderRadius={4} style={style} className={className} />;
}

export function SkeletonAvatar({ size = 48, className }: { size?: number; className?: string; }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} className={className} />;
}

export function SkeletonImage({
  width = '100%',
  height,
  borderRadius = 8,
  className,
}: { width?: number | string; height: number | string; borderRadius?: number; className?: string; }) {
  return <Skeleton width={width} height={height} borderRadius={borderRadius} className={className} />;
}

export function SkeletonButton({
  width = '100%',
  className,
}: { width?: number | string; className?: string; }) {
  return <Skeleton width={width} height={48} borderRadius={12} className={className} />;
}

// Composite / List Skeletons

export function SkeletonRow() {
  const { currentTheme } = useContext(UIThemeContext);
  const isDark = currentTheme === 'dark';
  return (
    <View className={`flex-row items-center gap-4 p-4 mb-3 rounded-2xl`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
      <SkeletonAvatar size={56} />
      <View className="flex-1 gap-2">
        <SkeletonText width="60%" />
        <SkeletonText width="40%" />
      </View>
      <View className="items-end gap-2">
        <SkeletonText width={50} />
      </View>
    </View>
  );
}

export function SkeletonCard() {
  const { currentTheme } = useContext(UIThemeContext);
  const isDark = currentTheme === 'dark';
  return (
    <View className={`w-full rounded-2xl p-4 mb-4`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
      <View className="flex-row items-center gap-3 mb-4">
         <SkeletonAvatar size={40} />
         <View className="flex-1 gap-2">
            <SkeletonText width="50%" />
            <SkeletonText width="30%" />
         </View>
      </View>
      <SkeletonImage height={120} borderRadius={12} />
      <View className="mt-4 flex-row justify-between items-center">
         <SkeletonText width="30%" />
         <SkeletonButton width={80} />
      </View>
    </View>
  );
}
