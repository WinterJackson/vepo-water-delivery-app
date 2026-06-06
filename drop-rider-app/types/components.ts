import { KeyboardTypeOptions } from 'react-native';
import { Order } from './models';

export interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: KeyboardTypeOptions;
  editable?: boolean;
  maxLength?: number;
}

export interface ActionItemProps {
  title: string;
  icon: string;
  description?: string;
  onPress: () => void;
}

export interface ToggleItemProps {
  title: string;
  icon: string;
  description?: string;
  value: boolean;
  onToggle: (value: boolean) => void;
}

export interface MiniVendorCardProps {
  FullMap: boolean;
  data: {
    id: string;
    title: string;
    owners_name: string;
    rating: number | null;
    image: string | null;
  };
}

export interface MiniOrderCardProps {
  data?: Order;
}
