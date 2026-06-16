import React from 'react';
import { View, Dimensions } from 'react-native';
import { Skeleton, SkeletonAvatar, SkeletonText, SkeletonImage } from '../ui/Skeleton';
import { useContext } from 'react';
import { UIThemeContext } from '@/context/ThemeContext';
import { BRAND } from '@/constants/brandColors';

export function VendorCardSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';
    
    return (
        <View 
            className="mb-4 rounded-3xl p-4 overflow-hidden border" 
            style={{ 
                backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, 
                borderColor: isDark ? BRAND.gray800 : BRAND.gray200 
            }}
        >
            <View className="flex-row items-center gap-4">
                {/* Left Side: Image */}
                <Skeleton width={80} height={80} borderRadius={16} />
                
                {/* Right Side: Info */}
                <View className="flex-1 justify-center gap-1">
                    <SkeletonText width="70%" />
                    
                    <View className="flex-row items-center gap-2 my-1">
                        <Skeleton width={40} height={16} borderRadius={4} />
                        <Skeleton width={60} height={16} borderRadius={4} />
                    </View>
                    
                    <View className="flex-row flex-wrap gap-2 mt-1">
                        <Skeleton width={70} height={24} borderRadius={6} />
                        <Skeleton width={80} height={24} borderRadius={6} />
                    </View>
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
        </View>
    );
}

export function SavedLocationSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="flex-row items-center p-4 rounded-2xl mb-2" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
            <Skeleton width={40} height={40} borderRadius={20} />
            <View className="flex-1 ml-3 gap-2">
                <SkeletonText width="40%" />
                <SkeletonText width="80%" />
            </View>
            <View className="flex-row items-center gap-2">
                <Skeleton width={50} height={28} borderRadius={14} />
                <Skeleton width={32} height={32} borderRadius={16} />
            </View>
        </View>
    );
}

export function NotificationItemSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="p-4 rounded-2xl border-l-4 mb-3" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderLeftColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
            <View className="flex-row items-start gap-4">
                <Skeleton width={48} height={48} borderRadius={24} />
                <View className="flex-1 gap-2">
                    <SkeletonText width="60%" />
                    <SkeletonText width="90%" />
                    <SkeletonText width="30%" />
                </View>
            </View>
        </View>
    );
}

export function CartItemSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="flex-row gap-3 p-3 rounded-[24px] justify-between mb-4" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
            <View className="flex-row gap-2 items-center">
                <Skeleton width={80} height={80} borderRadius={16} />
            </View>
            <View className="gap-2 justify-center flex-1 ml-2">
                <SkeletonText width="80%" />
                <SkeletonText width="40%" />
            </View>
            <View className="gap-4 items-end justify-center">
                <Skeleton width={60} height={16} borderRadius={8} />
                <Skeleton width={32} height={32} borderRadius={16} />
            </View>
        </View>
    );
}

export function OrderDetailSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="flex-1 px-4 mt-4 gap-5">
            {/* Tracking Status */}
            <View className="p-5 rounded-2xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                <SkeletonText width={140} />
                <View className="mt-4 flex-row items-center justify-between">
                    <Skeleton width={32} height={32} borderRadius={16} />
                    <Skeleton width={32} height={32} borderRadius={16} />
                    <Skeleton width={32} height={32} borderRadius={16} />
                    <Skeleton width={32} height={32} borderRadius={16} />
                    <Skeleton width={32} height={32} borderRadius={16} />
                </View>
                <View className="mt-6 flex-row items-center justify-between">
                    <SkeletonText width={100} />
                    <SkeletonText width={80} />
                </View>
            </View>

            {/* Vendor Info */}
            <View className="p-5 rounded-2xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                <View className="flex-row items-center gap-3">
                    <Skeleton width={48} height={48} borderRadius={24} />
                    <View className="gap-2">
                        <SkeletonText width={120} />
                        <SkeletonText width={160} />
                    </View>
                </View>
            </View>

            {/* Items */}
            <View className="p-5 rounded-2xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                <View className="flex-row items-center gap-3 mb-3">
                    <Skeleton width={56} height={56} borderRadius={16} />
                    <View className="flex-1 gap-2">
                        <SkeletonText width={100} />
                        <SkeletonText width={60} />
                    </View>
                    <SkeletonText width={50} />
                </View>
                <View className="flex-row items-center gap-3 mb-3">
                    <Skeleton width={56} height={56} borderRadius={16} />
                    <View className="flex-1 gap-2">
                        <SkeletonText width={100} />
                        <SkeletonText width={60} />
                    </View>
                    <SkeletonText width={50} />
                </View>
            </View>
        </View>
    );
}

export function PaymentRecordSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="mb-3">
            <View className="p-4 rounded-2xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                <View className="flex-row justify-between items-center mb-2">
                    <View className="flex-row items-center gap-2">
                        <Skeleton width={24} height={24} borderRadius={12} />
                        <SkeletonText width={100} />
                    </View>
                    <SkeletonText width={80} />
                </View>
                <View className="flex-row justify-between items-center mt-2">
                    <SkeletonText width={90} />
                    <SkeletonText width={70} />
                </View>
            </View>
        </View>
    );
}

export function OfferItemSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';
    const { width } = Dimensions.get("window");

    return (
        <View style={{ width: '100%', paddingHorizontal: 8, paddingVertical: 10 }}>
            <View className="rounded overflow-hidden w-full" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                <Skeleton width="100%" height={width * 0.3} borderRadius={0} />
                <View className="w-full h-[50px] px-1 py-2">
                    <SkeletonText width="80%" />
                    <View className="flex-row justify-between items-center mt-1">
                        <View className="flex-row gap-2">
                            <SkeletonText width={50} />
                            <SkeletonText width={40} />
                        </View>
                        <View className="flex-row gap-1 items-center">
                            <Skeleton width={20} height={20} borderRadius={10} />
                            <SkeletonText width={40} />
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

export function RepeatOrderSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="flex-1 px-5 mt-5 gap-5">
            {/* Vendor Info */}
            <View className="flex-row items-center gap-4 p-4 rounded-2xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                <Skeleton width={48} height={48} borderRadius={24} />
                <View className="gap-2">
                    <SkeletonText width={120} />
                    <SkeletonText width={160} />
                </View>
            </View>

            {/* Order Items */}
            <View>
                <SkeletonText width={100} className="mb-3" />
                <View className="p-4 rounded-2xl gap-4" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center gap-3 flex-1">
                            <Skeleton width={32} height={32} borderRadius={16} />
                            <SkeletonText width={150} />
                        </View>
                        <SkeletonText width={60} />
                    </View>
                    <View className="flex-row justify-between items-center mt-2 border-t pt-4" style={{ borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                        <SkeletonText width={80} />
                        <SkeletonText width={80} />
                    </View>
                </View>
            </View>

            {/* Total */}
            <View className="flex-row justify-between items-center p-4 rounded-2xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                <SkeletonText width={60} />
                <SkeletonText width={100} />
            </View>
        </View>
    );
}

export function BottleWalletSkeleton() {
    const { currentTheme } = useContext(UIThemeContext);
    const isDark = currentTheme === 'dark';

    return (
        <View className="flex-1 px-4 mt-6 gap-6">
            {/* Hero Balance Card */}
            <View className="p-6 rounded-3xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                <SkeletonText width={100} />
                <View className="flex-row items-end mt-2">
                    <Skeleton width={60} height={48} borderRadius={8} />
                    <View className="ml-2 mb-1.5">
                        <SkeletonText width={40} />
                    </View>
                </View>
                <View className="mt-4">
                    <SkeletonText width="90%" />
                    <SkeletonText width="60%" />
                </View>
            </View>

            {/* Metric Cards */}
            <View className="flex-row gap-3">
                <View className="flex-1 p-5 rounded-3xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <Skeleton width={32} height={32} borderRadius={16} />
                    <View className="mt-3">
                        <SkeletonText width={80} />
                        <SkeletonText width={100} />
                    </View>
                </View>
                <View className="flex-1 p-5 rounded-3xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <Skeleton width={32} height={32} borderRadius={16} />
                    <View className="mt-3">
                        <SkeletonText width={80} />
                        <SkeletonText width={100} />
                    </View>
                </View>
            </View>

            {/* How It Works Section */}
            <View className="mt-4">
                <SkeletonText width={120} />
                <View className="mt-4 gap-3">
                    <View className="p-4 rounded-2xl flex-row items-start gap-3" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                        <Skeleton width={24} height={24} borderRadius={12} />
                        <View className="flex-1 gap-2">
                            <SkeletonText width={100} />
                            <SkeletonText width="100%" />
                            <SkeletonText width="80%" />
                        </View>
                    </View>
                    <View className="p-4 rounded-2xl flex-row items-start gap-3" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                        <Skeleton width={24} height={24} borderRadius={12} />
                        <View className="flex-1 gap-2">
                            <SkeletonText width={100} />
                            <SkeletonText width="100%" />
                            <SkeletonText width="80%" />
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

export function CustomerOnboardingSkeleton() {
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

            <View className="gap-5 mt-4">
                <View className="p-5 rounded-3xl" style={{ backgroundColor: isDark ? BRAND.bgDark : BRAND.bgLight, borderWidth: 1, borderColor: isDark ? BRAND.gray800 : BRAND.gray200 }}>
                    <SkeletonText width={120} className="mb-2" />
                    <SkeletonText width={250} className="mb-4" />
                    <Skeleton width="100%" height={55} borderRadius={16} />
                </View>
            </View>

            <View className="mt-8">
                <Skeleton width="100%" height={55} borderRadius={28} />
            </View>
        </View>
    );
}
