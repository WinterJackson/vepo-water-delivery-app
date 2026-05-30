import VendorApiRoutes from "@/API/routes/VendorApiRoutes";
import { UIThemeContext } from "@/context/ThemeContext";
import { BRAND } from "@/constants/brandColors";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useState, memo } from "react";
import {
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    View,
    TextInput,
    Switch
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import PressableScale from "@/components/ui/PressableScale";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";
import * as Haptics from "expo-haptics";
import { trackEvent } from "@/utils/analytics";
import { Popup } from "@/lib/popup";
import SearchBar from "@/components/common/Search";
import { useVendorProducts } from "@/hooks/queries/useVendorProducts";

const ProductCard = memo(({ item, darkTheme, onDelete, onToggleAvailability }: { item: any, darkTheme: boolean, onDelete: (id: string) => void, onToggleAvailability: (id: string, isAvailable: boolean) => void }) => {
  return (
    <View 
      className={`flex-row items-center p-5 mb-4 rounded-[24px] border shadow-sm ${item.stock === 0 ? "opacity-60" : ""} ${darkTheme ? "bg-surface-container border-outline-variant" : "bg-white border-gray-100"}`} 
      style={darkTheme ? { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) } : { ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}
    >
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-2">
          <Text className={`font-bold text-lg ${darkTheme ? "text-white" : "text-slate-900"}`}>
            {item.name}
          </Text>
          {item.stock === 0 ? (
            <View className="bg-slate-500/10 border border-slate-500/20 px-2 py-1 rounded-md">
              <Text className="text-slate-500 text-[10px] font-bold uppercase">Out of Stock</Text>
            </View>
          ) : item.stock <= 5 ? (
            <View className="bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md">
              <Text className="text-amber-600 text-[10px] font-bold uppercase">Low Stock</Text>
            </View>
          ) : null}
        </View>
        <View className="flex-row items-center gap-4">
          <Text className={`text-base font-semibold ${darkTheme ? "text-slate-300" : "text-slate-700"}`}>
            KSH {item.price}
          </Text>
          <View className="w-1 h-1 rounded-full bg-slate-300" />
          <Text className={`text-sm ${item.stock <= 5 ? "text-red-500 font-bold" : darkTheme ? "text-slate-400" : "text-slate-500"}`}>
            Stock: {item.stock}
          </Text>
        </View>
      </View>
      
      <View className="flex-row items-center gap-3">
        <Switch
          value={item.is_available}
          onValueChange={(val) => onToggleAvailability(item.id, val)}
          trackColor={{ false: darkTheme ? "#333" : "#e2e8f0", true: BRAND.primary }}
          thumbColor={item.is_available ? "#fff" : "#f4f3f4"}
          style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
        />
        <PressableScale 
          onPress={() => onDelete(item.id)} 
          className={`w-10 h-10 rounded-full items-center justify-center ${darkTheme ? "bg-red-900/20" : "bg-red-50"}`}
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </PressableScale>
      </View>
    </View>
  );
});

export default function Products() {
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const { getToken } = useAuth();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState("");

  const {
    data: productsData,
    isFetching: productLoading,
    fetchNextPage: fetchNextProducts,
    hasNextPage: hasNextProducts,
    refetch,
    isError
  } = useVendorProducts(searchState, filter, 20);

  const filteredProducts = productsData?.pages?.flatMap(page => page) || [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleDelete = useCallback(async (productId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Popup.show({
      title: "Delete Product",
      message: "Are you sure you want to permanently delete this product?",
      cancelText: "Cancel",
      confirmText: "Delete",
      isDestructive: true,
      onConfirm: async () => {
          Popup.hide();
          const token = await getToken();
          const route = VendorApiRoutes.DeleteProduct(productId);
          try {
            await fetch(route.path, {
              method: route.method,
              headers: { Authorization: `Bearer ${token}` },
            });
            await refetch();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e) { 
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            if (__DEV__) console.error("Caught Unhandled Exception:", e); 
          }
        }
    });
  }, [getToken, refetch]);

  const handleToggleAvailability = useCallback(async (productId: string, isAvailable: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const token = await getToken();
    const route = VendorApiRoutes.UpdateProduct(productId);
    
    // Optimistic UI update could be done here by manipulating cache, but refetch is safer for now
    try {
      await fetch(route.path, {
        method: route.method,
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ is_available: isAvailable }),
      });
      await refetch();
    } catch (e) {
      if (__DEV__) console.error("Toggle error:", e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [getToken, refetch]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 1) {
        setSearchState(searchQuery.trim());
        trackEvent('vendor_inventory_search', { query: searchQuery.trim(), count: filteredProducts.length });
      } else {
        setSearchState("");
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, filteredProducts.length]);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <ProductCard item={item} darkTheme={darkTheme} onDelete={handleDelete} onToggleAvailability={handleToggleAvailability} />
  ), [darkTheme, handleDelete, handleToggleAvailability]);

  return (
    <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
      <StatusBar translucent backgroundColor={darkTheme ? "black" : "white"} barStyle={darkTheme ? "light-content" : "dark-content"} />

      {/* Header and Search */}
      <View style={{ overflow: "hidden", paddingBottom: 4 }}>
        <View 
          className="pt-4 pb-4 mb-2 gap-3"
          style={{ 
            backgroundColor: darkTheme ? "#000" : "#fff",
            borderBottomWidth: 1, 
            borderBottomColor: darkTheme ? BRAND.gray800 : BRAND.gray200,
            ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 })
          }}
        >
          <View className="flex-row items-center px-4">
            <PressableScale accessibilityLabel="Go Back" onPress={() => router.back()} activeOpacity={0.6}>
              <BackButtonMinimal />
            </PressableScale>
            <SearchBar
              width="flex-1 ml-3"
              height="h-[50px]"
              buttonStyle=""
              setFunc={setSearchQuery}
            />
          </View>
          
          {/* Filter Chips positioned directly below SearchBar */}
          <View className="pt-2">
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            >
              {[
                { id: "All", label: "All Products" }, 
                { id: "Low Stock", label: "Low Stock" }, 
                { id: "Out of Stock", label: "Out of Stock" }
              ].map(f => (
                <PressableScale
                  key={f.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFilter(f.id);
                  }}
                  className={`px-4 py-2 rounded-full border ${filter === f.id ? "bg-accentbg border-accentbg" : darkTheme ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}
                  style={filter !== f.id ? { ...(darkTheme ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) } : {}}
                >
                  <Text className={`font-semibold text-sm ${filter === f.id ? "text-white" : darkTheme ? "text-gray-300" : "text-gray-600"}`}>
                    {f.label}
                  </Text>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <FlashList
          data={filteredProducts}
          keyExtractor={(item: any) => item.id}
          // @ts-ignore
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={darkTheme ? "white" : "black"} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 8 }}
          onEndReached={() => {
            if (hasNextProducts) fetchNextProducts();
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            productLoading && filteredProducts.length === 0 && !isError ? (
               <View className="gap-4 w-full pt-4">
                 <SkeletonRow />
                 <SkeletonRow />
                 <SkeletonRow />
                 <SkeletonRow />
              </View>
            ) : (
              <View className="items-center justify-center pt-24">
                <View className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${darkTheme ? "bg-slate-800" : "bg-white"}`}>
                  <Ionicons name="cube-outline" size={40} color={BRAND.primary} />
                </View>
                <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>No products found</Text>
                <Text className={`text-base mt-2 text-center px-10 ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
                  {searchQuery ? "Try adjusting your search filters" : "Add your first product to start selling"}
                </Text>
              </View>
            )
          }
          renderItem={renderItem}
        />
      </View>

      {/* Floating Action Button (FAB) */}
      <PressableScale
        activeOpacity={0.8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push("/(screens)/AddProduct");
        }}
        className="absolute right-5 bottom-[100px] bg-accentbg w-14 h-14 rounded-2xl items-center justify-center"
        style={{ ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }) }}
      >
        <Ionicons name="add" size={28} color="white" />
      </PressableScale>
    </SafeAreaView>
  );
}
