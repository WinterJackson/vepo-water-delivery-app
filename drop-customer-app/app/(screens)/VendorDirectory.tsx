import React, { useContext, useState } from 'react';
import { View, Text, ScrollView, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UIThemeContext } from '@/context/ThemeContext';
import { useVendorDirectory } from '@/hooks/queries/useVendors';
import { PressableScale } from '@/components/ui/PressableScale';
import BackButtonMinimal from '@/components/ui/BackButtonMinimal';
import SearchBar from '@/components/common/Search';
import { BRAND, TOAST } from '@/constants/brandColors';
import { estimateDeliveryTime } from '@/utils/distance';
import { useUserDetails } from '@/hooks/queries/useUser';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { VendorCardSkeleton } from '@/components/skeletons/ContextualSkeletons';
import { FlashList } from '@shopify/flash-list';
import MapView, { Marker, UrlTile, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from "@expo/vector-icons";

const VENDOR_FILTERS = [
    { id: 'all', label: 'All Vendors' },
    { id: 'retail_refill', label: 'Retail Vendors' },
    { id: 'wholesale_b2b', label: 'Wholesale Vendors' },
];

export default function VendorDirectory() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentTheme } = useContext(UIThemeContext);
    const darkTheme = currentTheme === 'dark';
    const { data: User } = useUserDetails();

    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all');

    const { data: vendors, isLoading } = useVendorDirectory();

    const filteredVendors = React.useMemo(() => {
        if (!vendors) return [];
        let result = vendors;
        if (filter !== 'all') {
            result = result.filter((v: import("@/types/models").Vendor) => v.vendor_type === filter);
        }
        if (searchQuery.trim()) {
            result = result.filter((v: import("@/types/models").Vendor) => v.business_name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return result;
    }, [vendors, filter, searchQuery]);

    const renderVendor = ({ item }: { item: any }) => {
        const isWholesale = item.vendor_type === 'wholesale_b2b';
        return (
            <PressableScale
                onPress={() => router.push(`/vendor/${item.id}`)}
                className={`mb-4 rounded-3xl p-4 overflow-hidden border ${darkTheme ? 'bg-surface-container border-white/5' : 'bg-white border-gray-200'}`}
				style={darkTheme ? undefined : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
            >
                <View className="flex-row items-center gap-4">
                    <View className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-200">
                        <Image source={{ uri: item.profile_pic }} style={{ width: '100%', height: '100%' }} />
                    </View>
                    <View className="flex-1 justify-center gap-1">
                        <Text className={`text-lg font-bold ${darkTheme ? 'text-white' : 'text-gray-900'}`} numberOfLines={1}>
                            {item.business_name}
                        </Text>
                        <View className="flex-row items-center gap-2">
                            <Text className={`${darkTheme ? 'text-gray-400' : 'text-gray-600'} font-medium`}>
                                ⭐ {Number(item.rating).toFixed(1)}
                            </Text>
                            <Text className={`${darkTheme ? 'text-gray-500' : 'text-gray-400'}`}>•</Text>
                            <View className="flex-row items-center gap-1">
                                <Ionicons name="bicycle" size={24} color={BRAND.primary} />
                                <Text className={`${darkTheme ? "text-gray-400" : "text-gray-600"}`}>{estimateDeliveryTime(item.lat, item.lng, User?.lat, User?.lng)}</Text>
                            </View>
                        </View>
                        <View className="flex-row flex-wrap gap-2 mt-1">
                            <View className={`px-2 py-1 rounded-md ${isWholesale ? 'bg-blue-100' : 'bg-green-100'}`}>
                                <Text className={`text-xs font-bold ${isWholesale ? 'text-blue-800' : 'text-green-800'}`}>
                                    {isWholesale ? 'Wholesale' : 'Retail'}
                                </Text>
                            </View>
                            {item.products && (
                                <View className={`px-2 py-1 rounded-md ${darkTheme ? 'bg-white/10' : 'bg-white'}`}>
                                    <Text className={`text-xs ${darkTheme ? 'text-gray-300' : 'text-gray-600'}`}>
                                        {item.products.length} Products
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </PressableScale>
        );
    };

    return (
        <View className={`flex-1 ${darkTheme ? 'bg-black' : 'bg-background'}`}>
            <StatusBar barStyle={darkTheme ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
            
            {/* Header */}
            <View className={`px-4 pb-4 ${darkTheme ? 'bg-black border-white/10' : 'bg-white border-gray-100'}`} style={{ paddingTop: insets.top + 16, borderBottomWidth: 1 }}>
                <View className="flex-row items-center gap-3">
                    <PressableScale onPress={() => router.back()}>
                        <BackButtonMinimal />
                    </PressableScale>
                    <SearchBar
                        width="flex-1"
                        height="h-[46px]"
                        buttonStyle=""
                        setFunc={setSearchQuery}
                    />
                </View>
            </View>

            {/* Map Area */}
            <View className="h-56 relative overflow-hidden" style={{ backgroundColor: darkTheme ? '#1f2937' : '#e5e7eb' }}>
                <MapView
                    // 🟢 FREE OPEN SOURCE MVP MODE 
                    // Uncomment this block for MVP:
                    provider={undefined}
                    // 🔴 PRODUCTION GOOGLE MAPS MODE 
                    // Uncomment this block for Production:
                    // provider={PROVIDER_GOOGLE}
                    style={{ flex: 1 }}
                    initialRegion={{
                        latitude: User?.lat || -1.2921,
                        longitude: User?.lng || 36.8219,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }}
                >
                    {/* 🟢 FREE OPEN SOURCE MVP MODE */}
                    {/* Uncomment this block for MVP: */}
                    {UrlTile && <UrlTile urlTemplate={darkTheme ? "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png" : "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"} maximumZ={20} />}

                    {/* User Marker */}
                    {User?.lat && User?.lng && (
                        <Marker
                            coordinate={{ latitude: User.lat, longitude: User.lng }}
                            title="You are here"
                            pinColor={BRAND.primary}
                        />
                    )}
                    {/* Vendor Markers */}
                    {filteredVendors.map((vendor: import("@/types/models").Vendor) => {
                        if (!vendor.lat || !vendor.lng) return null;
                        return (
                            <Marker
                                key={vendor.id}
                                coordinate={{ latitude: vendor.lat, longitude: vendor.lng }}
                                title={vendor.business_name}
                                description={vendor.vendor_type === 'wholesale_b2b' ? 'Wholesale Vendor' : 'Retail Vendor'}
                                pinColor={BRAND.primary}
                                onPress={() => router.push(`/vendor/${vendor.id}`)}
                            />
                        );
                    })}
                </MapView>
            </View>

            {/* Filters */}
            <View className="px-4 py-4">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {VENDOR_FILTERS.map((f) => (
                        <PressableScale
                            key={f.id}
                            onPress={() => setFilter(f.id)}
                            className={`px-4 py-2 rounded-full border ${filter === f.id ? 'bg-accentbg border-accentbg' : darkTheme ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}
							style={darkTheme || filter === f.id ? undefined : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
                        >
                            <Text className={`font-semibold ${filter === f.id ? 'text-white' : darkTheme ? 'text-gray-300' : 'text-gray-600'}`}>
                                {f.label}
                            </Text>
                        </PressableScale>
                    ))}
                </ScrollView>
            </View>

            {/* List */}
            <View className="flex-1 px-4">
                {isLoading ? (
                    <View className="gap-4">
                        {[1, 2, 3].map((i) => (
                            <VendorCardSkeleton key={i} />
                        ))}
                    </View>
                ) : filteredVendors.length === 0 ? (
                    <View className="flex-1 items-center justify-center pb-20">
                        <Text className={`text-lg font-bold ${darkTheme ? 'text-white' : 'text-gray-900'}`}>No vendors found</Text>
                        <Text className={`text-center mt-2 ${darkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                            Try adjusting your filters or search query
                        </Text>
                    </View>
                ) : (
                    <FlashList
                        data={filteredVendors}
						// @ts-ignore
						estimatedItemSize={120}
                        keyExtractor={(item) => item.id}
                        renderItem={renderVendor}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 120 }}
                    />
                )}
            </View>
        </View>
    );
}
