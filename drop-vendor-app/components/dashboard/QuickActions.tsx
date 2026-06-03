import React, { useContext } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import PressableScale from '@/components/ui/PressableScale';
import { UIThemeContext } from '@/context/ThemeContext';
import { BRAND } from '@/constants/brandColors';

export default function QuickActions() {
    const router = useRouter();
    const { currentTheme } = useContext(UIThemeContext);
    const darkTheme = currentTheme === "dark";

    const ActionButton = ({ icon, label, color, path }: any) => (
        <PressableScale onPress={() => router.push(path)} className="items-center flex-1">
            <View className={`w-14 h-14 rounded-full items-center justify-center mb-2 shadow-sm border ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} style={darkTheme ? { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) } : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}>
                <Ionicons name={icon} size={24} color={BRAND.primary} />
            </View>
            <Text className={`text-xs font-semibold ${darkTheme ? "text-slate-300" : "text-slate-600"}`}>{label}</Text>
        </PressableScale>
    );

    return (
        <View className="flex-row justify-between px-4 mt-6">
            <ActionButton icon="add" label="Add Item" color={BRAND.primary} path="/(screens)/AddProduct" />
            <ActionButton icon="cube-outline" label="Orders" color="#10b981" path="/(screens)/Orders" />
            <ActionButton icon="bicycle-outline" label="Riders" color={BRAND.primary} path="/(screens)/RiderManagement" />
            <ActionButton icon="person-outline" label="Profile" color={BRAND.primary} path="/(screens)/Profile" />
        </View>
    );
}
