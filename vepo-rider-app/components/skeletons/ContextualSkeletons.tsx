import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, SkeletonAvatar, SkeletonText, SkeletonImage, SkeletonRow } from '../ui/Skeleton';
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

export function RiderEarningsSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="flex-1 w-full pt-6 gap-6">
            <Skeleton width="100%" height={160} borderRadius={16} />
            <View className={`rounded-3xl p-4 shadow-sm`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                {[1, 2, 3].map((i) => (
                    <View key={i} className={`flex-row justify-between py-4 border-b`} style={{ borderBottomColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                        <SkeletonText width={120} />
                        <SkeletonText width={80} />
                    </View>
                ))}
                <View className="flex-row justify-between py-4">
                    <SkeletonText width={120} />
                    <SkeletonText width={80} />
                </View>
            </View>
        </View>
    );
}

export function RiderEarningsHistorySkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="pt-4 gap-4">
            <SkeletonText width="30%" className="mb-2" />
            {[1, 2, 3].map((i) => (
                <View key={i} className={`rounded-2xl p-4 flex-row items-center justify-between border`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <View className="flex-row items-center flex-1">
                        <Skeleton width={48} height={48} borderRadius={24} className="mr-3" />
                        <View className="flex-1 gap-2">
                            <SkeletonText width="60%" />
                            <SkeletonText width="40%" />
                        </View>
                    </View>
                    <Skeleton width={80} height={24} borderRadius={12} />
                </View>
            ))}
        </View>
    );
}

export function RiderPerformanceSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="flex-1 px-4 pt-2">
            <View className={`w-full rounded-2xl p-5 border mb-6`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                <View className="flex-row items-center justify-between mb-4">
                    <View>
                        <SkeletonText width={100} className="mb-2" />
                        <SkeletonText width={140} />
                    </View>
                    <Skeleton width={60} height={60} borderRadius={30} />
                </View>
                <Skeleton width="100%" height={12} borderRadius={6} />
            </View>
            <View className="flex-row justify-between gap-3">
                <Skeleton width="48%" height={120} borderRadius={16} />
                <Skeleton width="48%" height={120} borderRadius={16} />
            </View>
        </View>
    );
}

export function RiderDiscoverVendorCardSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className={`p-4 mb-4 rounded-2xl flex-row items-center`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
            <Skeleton width={56} height={56} borderRadius={28} className="mr-4" />
            <View className="flex-1 gap-2">
                <View className="flex-row justify-between items-center">
                    <SkeletonText width="60%" />
                    <SkeletonText width="20%" />
                </View>
                <SkeletonText width="80%" />
                <Skeleton width="100%" height={40} borderRadius={8} className="mt-2" />
            </View>
        </View>
    );
}

export function RiderNotificationItemSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className={`p-4 rounded-2xl mb-3`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
            <View className="flex-row items-start gap-4">
                <Skeleton width={48} height={48} borderRadius={24} />
                <View className="flex-1 gap-2 pt-1">
                    <SkeletonText width="70%" />
                    <SkeletonText width="100%" />
                    <SkeletonText width="80%" />
                    <SkeletonText width="30%" className="mt-1" />
                </View>
            </View>
        </View>
    );
}

export function RiderReviewsSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="flex-1 px-4 pt-2">
            <View className={`w-full rounded-2xl p-5 border flex-row items-center justify-between mb-6`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                <View className="items-center mr-6">
                    <Skeleton width={60} height={48} borderRadius={4} className="mb-2" />
                    <Skeleton width={80} height={16} borderRadius={8} className="mb-1" />
                    <SkeletonText width={60} />
                </View>
                <View className="flex-1 gap-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <View key={i} className="flex-row items-center">
                            <SkeletonText width={16} className="mr-2" />
                            <Skeleton width="100%" height={8} borderRadius={4} />
                        </View>
                    ))}
                </View>
            </View>
            <SkeletonText width="40%" className="mb-4" />
            {[1, 2].map((i) => (
                <View key={i} className={`p-4 rounded-xl mb-3 border`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <View className="flex-row justify-between mb-3">
                        <Skeleton width={80} height={14} borderRadius={7} />
                        <SkeletonText width={40} />
                    </View>
                    <SkeletonText width="100%" />
                    <SkeletonText width="80%" className="mt-2" />
                </View>
            ))}
        </View>
    );
}

export function RiderRemittanceSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="gap-3 pb-8">
            {[1, 2, 3].map((i) => (
                <View key={i} className={`p-4 rounded-2xl border`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <View className="flex-row justify-between items-center">
                        <SkeletonText width="40%" />
                        <Skeleton width={60} height={16} borderRadius={8} />
                    </View>
                    <View className="flex-row mt-2 gap-4">
                        {[1, 2, 3, 4].map((j) => (
                            <View key={j}>
                                <SkeletonText width={40} className="mb-1" />
                                <SkeletonText width={30} />
                            </View>
                        ))}
                    </View>
                    <SkeletonText width={80} className="mt-3" />
                </View>
            ))}
        </View>
    );
}

export function RiderTripRadarSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="gap-3 pb-8 px-4">
            {[1, 2, 3].map((i) => (
                <View key={i} className={`p-4 rounded-2xl border`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <View className="flex-row justify-between items-start">
                        <View className="flex-1">
                            <Skeleton width={100} height={18} borderRadius={4} className="mb-2" />
                            <SkeletonText width="70%" />
                            <SkeletonText width="50%" className="mt-1" />
                        </View>
                        <View className="items-end">
                            <Skeleton width={60} height={20} borderRadius={4} />
                            <SkeletonText width={40} className="mt-2" />
                        </View>
                    </View>
                    <View className="flex-row gap-3 mt-4">
                        <Skeleton width={50} height={16} borderRadius={4} />
                        <Skeleton width={50} height={16} borderRadius={4} />
                        <Skeleton width={80} height={16} borderRadius={4} />
                    </View>
                </View>
            ))}
        </View>
    );
}
export function RiderMapSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight }]} className={`items-center justify-center`}>
            <Skeleton width="100%" height="100%" borderRadius={0} />
            <View className="absolute inset-0 items-center justify-center">
                <View className={`p-4 rounded-full shadow-lg`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.white }}>
                    <Skeleton width={32} height={32} borderRadius={16} />
                </View>
            </View>
        </View>
    );
}

export function RiderActiveDeliverySkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className={`p-4 rounded-3xl border`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
            <View className="flex-row justify-between items-start">
                <View>
                    <SkeletonText width={120} className="mb-2" />
                    <SkeletonText width={160} />
                    <SkeletonText width={100} className="mt-2" />
                </View>
                <Skeleton width={45} height={45} borderRadius={22.5} />
            </View>

            <View className="flex-row gap-2 mt-4 pt-4" style={{ borderTopWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : BRAND.gray200 }}>
                <Skeleton width="48%" height={48} borderRadius={12} />
                <Skeleton width="48%" height={48} borderRadius={12} />
            </View>
            
            <View className="mt-6 gap-3">
                <Skeleton width="100%" height={56} borderRadius={28} />
            </View>
        </View>
    );
}

export function RiderOrderCardSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="gap-4 w-full">
            {[1, 2, 3].map((i) => (
                <View key={i} className={`p-4 rounded-2xl border`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <View className="flex-row justify-between items-center mb-2">
                        <SkeletonText width={120} />
                        <Skeleton width={80} height={24} borderRadius={12} />
                    </View>
                    
                    <View className="mb-2">
                        <Skeleton width={150} height={16} borderRadius={4} />
                    </View>

                    <View className="flex-row justify-between">
                        <View>
                            <SkeletonText width={100} className="mb-1" />
                            <SkeletonText width={160} />
                        </View>
                    </View>

                    <View className="flex-row mt-4 gap-2 pt-4" style={{ borderTopWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : BRAND.gray200 }}>
                        <Skeleton width="48%" height={48} borderRadius={12} />
                        <Skeleton width="48%" height={48} borderRadius={12} />
                    </View>
                </View>
            ))}
        </View>
    );
}

export function RiderProfileSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="px-5 pt-6 pb-8 w-full">
            <View className="items-center mb-8">
                <Skeleton width={96} height={96} borderRadius={48} className="mb-4" />
                <SkeletonText width={120} className="mb-2" />
                <SkeletonText width={160} className="mb-1" />
                <SkeletonText width={100} />
            </View>

            <View className="flex-row justify-between items-center mb-2 px-1">
                <Skeleton width={100} height={20} borderRadius={4} />
                <Skeleton width={60} height={28} borderRadius={14} />
            </View>

            <View className={`rounded-2xl p-4`} style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight }}>
                {[1, 2, 3, 4, 5].map((i, idx) => (
                    <View key={i} className={`flex-row justify-between py-3`} style={{ borderBottomWidth: idx < 4 ? 1 : 0, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                        <SkeletonText width={60} />
                        <SkeletonText width={100} />
                    </View>
                ))}
            </View>
        </View>
    );
}

export function RiderSettingsSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="px-5 pt-10 pb-8 w-full">
            <View className="items-center mb-10">
                <Skeleton width={100} height={100} borderRadius={50} className="mb-4" />
                <SkeletonText width={140} className="mb-1" />
                <SkeletonText width={100} />
            </View>

            {[1, 2, 3, 4].map((section) => (
                <View key={section} className="mb-8 w-full">
                    <SkeletonText width={120} className="mb-4" />
                    {[1, 2].map((item) => (
                        <View key={item} className={`flex-row items-center justify-between py-4 border-b`} style={{ borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                            <View className="flex-row items-center gap-4">
                                <Skeleton width={40} height={40} borderRadius={20} />
                                <SkeletonText width={150} />
                            </View>
                            <Skeleton width={20} height={20} borderRadius={10} />
                        </View>
                    ))}
                </View>
            ))}
        </View>
    );
}

export function RiderCashoutSkeleton() {
    return (
        <View className="flex-1 px-4 pt-6 gap-6 w-full">
            <Skeleton width="100%" height={180} borderRadius={24} />
            <Skeleton width="100%" height={280} borderRadius={16} />
            <SkeletonRow />
            <SkeletonRow />
        </View>
    );
}

export function RiderVerificationSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="flex-1 px-5 pt-6 w-full">
            <SkeletonText width={100} className="mb-3" />
            
            <View className="flex-row gap-2 mb-6">
                <Skeleton width="31%" height={48} borderRadius={8} />
                <Skeleton width="31%" height={48} borderRadius={8} />
                <Skeleton width="31%" height={48} borderRadius={8} />
            </View>

            <View className="mb-8">
                <SkeletonText width={140} className="mb-2" />
                <Skeleton width="100%" height={56} borderRadius={12} />
            </View>

            {[1, 2, 3].map((i) => (
                <View key={i} className="mb-6">
                    <SkeletonText width={120} className="mb-1" />
                    <SkeletonText width={200} className="mb-3" />
                    <Skeleton width="100%" height={160} borderRadius={12} />
                </View>
            ))}
        </View>
    );
}

export function RiderOnboardingSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="flex-1 px-6 pt-12 gap-8">
            <View className="items-center mb-6 mt-8">
                <SkeletonText width={220} className="mb-4" />
                <View className="mt-2 items-center">
                    <SkeletonText width={280} className="mb-2" />
                    <SkeletonText width={200} />
                </View>
            </View>

            <View className="gap-5">
                <View className="p-5 rounded-3xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <SkeletonText width={140} className="mb-4" />
                    <Skeleton width="100%" height={55} borderRadius={16} />
                </View>

                <View className="p-5 rounded-3xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <SkeletonText width={100} className="mb-4" />
                    <Skeleton width="100%" height={55} borderRadius={16} />
                </View>

                <View className="p-5 rounded-3xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <SkeletonText width={120} className="mb-4" />
                    <Skeleton width="100%" height={55} borderRadius={16} className="mb-4" />
                    <Skeleton width="100%" height={55} borderRadius={16} />
                </View>
            </View>

            <View className="mt-10">
                <Skeleton width="100%" height={55} borderRadius={28} />
            </View>
        </View>
    );
}
