import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  className?: string; // Support for NativeWind classNames
  accessibilityRole?: 'button' | 'link' | 'image' | 'header' | 'none';
  accessibilityLabel?: string;
  activeOpacity?: number;
}

export function PressableScale({ children, style, accessibilityRole = 'button', accessibilityLabel, activeOpacity, ...props }: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (e: any) => {
    scale.value = withSpring(0.97, { mass: 1, damping: 15, stiffness: 300 });
    props.onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    scale.value = withSpring(1, { mass: 1, damping: 15, stiffness: 300 });
    props.onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={[
        { minHeight: 44, minWidth: 44, justifyContent: 'center' }, // Minimum touch target constraint
        animatedStyle,
        typeof style === 'function' ? style({ pressed: false }) : style,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

export default PressableScale;
