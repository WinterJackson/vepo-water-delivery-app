import React from 'react';
import { View } from 'react-native';
import { Skeleton, SkeletonAvatar, SkeletonText, SkeletonImage } from '../ui/Skeleton';
import { useContext } from 'react';
import { UIThemeContext } from '@/context/ThemeContext';
import { BRAND } from '@/constants/brandColors';

export function VendorCardSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';
    
    return (
        <View className={`w-full rounded-[24px] overflow-hidden mb-4`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
            {/* Banner Image */}
            <Skeleton width="100%" height={160} borderRadius={0} />
            
            <View className="p-4">
                <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center flex-1 gap-3">
                        <SkeletonAvatar size={48} />
                        <View className="flex-1 gap-2">
                            <SkeletonText width="60%" />
                            <SkeletonText width="40%" />
                        </View>
                    </View>
                    <Skeleton width={60} height={28} borderRadius={16} />
                </View>
                
                {/* Info row */}
                <View className="flex-row gap-4 mt-2">
                    <Skeleton width={80} height={20} borderRadius={6} />
                    <Skeleton width={80} height={20} borderRadius={6} />
                </View>
            </View>
        </View>
    );
}

export function ProductCardSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="w-full flex-row items-center p-3 mb-3 rounded-2xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
            <Skeleton width={80} height={80} borderRadius={16} />
            <View className="flex-1 ml-4 gap-2">
                <SkeletonText width="80%" />
                <SkeletonText width="40%" />
                <View className="flex-row items-center justify-between mt-2">
                    <Skeleton width={70} height={24} borderRadius={12} />
                    <Skeleton width={32} height={32} borderRadius={16} />
                </View>
            </View>
        </View>
    );
}

export function OrderCardSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="w-full rounded-[24px] p-4 mb-4" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-3">
                    <SkeletonAvatar size={40} />
                    <View className="gap-2">
                        <SkeletonText width={120} />
                        <SkeletonText width={80} />
                    </View>
                </View>
                <Skeleton width={70} height={28} borderRadius={14} />
            </View>
            <Skeleton width="100%" height={120} borderRadius={16} />
            <View className="flex-row justify-between items-center mt-4 pt-4 border-t" style={{ borderTopColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                <SkeletonText width={100} />
                <SkeletonText width={60} />
            </View>
        </View>
    );
}

export function HorizontalListSkeleton() {
    return (
        <View className="flex-row gap-4">
            <View className="w-32 gap-2">
                <Skeleton width={128} height={128} borderRadius={24} />
                <SkeletonText width="80%" />
                <SkeletonText width="50%" />
            </View>
            <View className="w-32 gap-2">
                <Skeleton width={128} height={128} borderRadius={24} />
                <SkeletonText width="80%" />
                <SkeletonText width="50%" />
            </View>
            <View className="w-32 gap-2">
                <Skeleton width={128} height={128} borderRadius={24} />
                <SkeletonText width="80%" />
                <SkeletonText width="50%" />
            </View>
        </View>
    );
}

export function VendorOrderCardSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="p-5 mb-4 rounded-[24px] border shadow-sm" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
            <View className="flex-row justify-between items-center mb-3">
                <SkeletonText width={120} />
                <Skeleton width={80} height={24} borderRadius={12} />
            </View>
            <SkeletonText width="60%" className="mb-1" />
            <SkeletonText width="40%" />
            <View className="flex-row gap-3 mt-4">
                <Skeleton width="48%" height={56} borderRadius={16} />
                <Skeleton width="48%" height={56} borderRadius={16} />
            </View>
        </View>
    );
}

export function VendorOrderDetailSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}>
            <View className={`flex-row items-center px-4 pt-4 pb-4 border-b shadow-sm`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                <Skeleton width={40} height={40} borderRadius={20} />
                <View className="ml-4 flex-1">
                    <Skeleton width="50%" height={24} borderRadius={8} />
                </View>
            </View>
            <View className="p-5 gap-5">
                <Skeleton width="100%" height={200} borderRadius={24} />
                <Skeleton width="100%" height={150} borderRadius={24} />
                <Skeleton width="100%" height={100} borderRadius={24} />
            </View>
        </View>
    );
}

export function VendorMapBottomSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="gap-5 w-full">
            {/* Delivery Radius Controller Skeleton */}
            <View className="rounded-[24px] p-5 border" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                <View className="flex-row justify-between items-center">
                    <View className="flex-1 mr-4 gap-2">
                        <SkeletonText width={80} />
                        <SkeletonText width={120} />
                    </View>
                    <Skeleton width={140} height={48} borderRadius={24} />
                </View>
            </View>

            {/* Order Stats Skeleton */}
            <View className="flex-row gap-4">
                <View className="flex-1 rounded-[24px] p-5 border gap-3" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <Skeleton width={40} height={40} borderRadius={20} />
                    <Skeleton width={60} height={32} borderRadius={8} />
                    <SkeletonText width={80} />
                </View>
                <View className="flex-1 rounded-[24px] p-5 border gap-3" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <Skeleton width={40} height={40} borderRadius={20} />
                    <Skeleton width={60} height={32} borderRadius={8} />
                    <SkeletonText width={80} />
                </View>
            </View>
        </View>
    );
}

export function VendorNotificationItemSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="p-4 mb-3 rounded-[24px] border-l-4" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200, borderLeftColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
            <View className="flex-row items-start gap-4">
                <Skeleton width={48} height={48} borderRadius={24} />
                <View className="flex-1 pt-1 gap-2">
                    <SkeletonText width="80%" />
                    <SkeletonText width="100%" />
                    <SkeletonText width="40%" />
                </View>
            </View>
        </View>
    );
}

export function VendorOnboardingSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="flex-1 px-6 pt-12 gap-8">
            <View className="items-center mb-6">
                <SkeletonText width={120} />
                <View className="mt-4">
                    <SkeletonText width={200} />
                </View>
                <View className="mt-2">
                    <SkeletonText width={160} />
                </View>
            </View>

            <View className="gap-6">
                <View className="p-5 rounded-3xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <SkeletonText width={100} className="mb-4" />
                    <Skeleton width="100%" height={55} borderRadius={16} />
                </View>

                <View className="p-5 rounded-3xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <SkeletonText width={120} className="mb-4" />
                    <Skeleton width="100%" height={55} borderRadius={16} />
                </View>

                <View className="p-5 rounded-3xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <SkeletonText width={80} className="mb-4" />
                    <Skeleton width="100%" height={55} borderRadius={16} />
                </View>
            </View>

            <View className="mt-8">
                <Skeleton width="100%" height={55} borderRadius={28} />
            </View>
        </View>
    );
}
