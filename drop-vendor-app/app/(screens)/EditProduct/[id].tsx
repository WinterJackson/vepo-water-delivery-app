import VendorApiRoutes from "@/API/routes/VendorApiRoutes";
import { UIThemeContext } from "@/context/ThemeContext";
import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useContext, useState, useEffect } from "react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Toast } from "@/lib/toast";
import * as Haptics from "expo-haptics";
import {
    ActivityIndicator,
    KeyboardAvoidingView, Platform,
    ScrollView, StatusBar,
    Text, TextInput, View,
} from "react-native";
import { Image } from "expo-image";
import { BRAND } from "@/constants/brandColors";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import PressableScale from "@/components/ui/PressableScale";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { useQueryClient } from "@tanstack/react-query";

export default function EditProduct() {
  const { id } = useLocalSearchParams();
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const { getToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { imageUri, uploading: imageUploading, error, pickImage, handleImageUpload } = useImageUpload();

  const [loadingData, setLoadingData] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [capacity, setCapacity] = useState("");
  const [unit, setUnit] = useState("litres");
  const [stock, setStock] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      const token = await getToken();
      try {
        const res = await fetch(VendorApiRoutes.GetProduct(id as string).path, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setName(data.name || "");
          setDescription(data.description || "");
          setImageUrl(data.image_url || "");
          setPrice(data.price?.toString() || "");
          setDiscount(data.discount?.toString() || "0");
          setCapacity(data.capacity?.toString() || "");
          setUnit(data.unit || "litres");
          setStock(data.stock?.toString() || "");
        } else {
          Toast.error("Error", "Could not load product details.");
        }
      } catch (e) {
        if (__DEV__) console.error(e);
      } finally {
        setLoadingData(false);
      }
    };
    if (id) fetchProduct();
  }, [id, getToken]);

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!name || !price || !capacity || !stock) {
      Toast.error("Validation Error", "Please fill in all required fields (Name, Price, Capacity, Stock).");
      return;
    }
    
    let finalImageUrl = imageUrl;
    if (imageUri && !imageUrl.startsWith('http')) {
      const uploadedUrl = await handleImageUpload();
      if (!uploadedUrl) {
        Toast.error("Error", "Failed to upload image");
        return;
      }
      finalImageUrl = uploadedUrl;
    } else if (!imageUri && !imageUrl) {
      Toast.error("Error", "Please select or provide an image URL");
      return;
    }

    setLoading(true);
    const token = await getToken();
    const payload = {
      name, description, image_url: finalImageUrl,
      price: parseFloat(price), discount: parseFloat(discount || "0"),
      capacity: parseFloat(capacity), unit, stock: parseInt(stock),
    };
    try {
      const route = VendorApiRoutes.UpdateProduct(id as string);
      const res = await fetch(route.path, {
        method: route.method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.success("Product updated!", "Your product details have been saved.");
        queryClient.invalidateQueries({ queryKey: ["vendorProducts"] });
        router.back();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const err = await res.json();
        Toast.error("Error", err.detail || "Failed to update product");
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.error("Error", "Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = `px-5 py-4 rounded-[16px] text-base font-bold border ${darkTheme ? "bg-surface-container text-white border-outline-variant focus:border-accentbg" : "bg-white text-slate-900 border-slate-200 focus:border-accentbg"}`;
  const labelStyle = `text-xs font-bold mb-2 ml-1 uppercase tracking-wider ${darkTheme ? "text-slate-400" : "text-slate-500"}`;

  if (loadingData) {
    return (
      <SafeAreaView className={`flex-1 items-center justify-center ${darkTheme ? "bg-black" : ""}`}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
      <StatusBar translucent backgroundColor={darkTheme ? "black" : "white"} barStyle={darkTheme ? "light-content" : "dark-content"} />

      <View style={{ overflow: "hidden", paddingBottom: 4 }}>
        <View 
          className="flex-row items-center px-4 py-3 pb-4 mb-2"
          style={{ 
            backgroundColor: darkTheme ? "#000" : "#fff",
            borderBottomWidth: 1, 
            borderBottomColor: darkTheme ? BRAND.gray800 : BRAND.gray200,
            ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 })
          }}
        >
          <PressableScale onPress={() => router.back()} className="mr-4">
            <BackButtonMinimal />
          </PressableScale>
          <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>Edit Product</Text>
        </View>
      </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
         <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120, paddingTop: 24, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
           <View className="gap-6">
             <View>
               <Text className={labelStyle}>Product Name *</Text>
               <TextInput className={inputStyle} placeholder="e.g., 20L Refill Water" placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"} value={name} onChangeText={setName} />
             </View>
             
             <View>
               <Text className={labelStyle}>Description</Text>
               <TextInput className={`${inputStyle} min-h-[100px] text-left align-top`} placeholder="Describe the product..." placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"} value={description} onChangeText={setDescription} multiline textAlignVertical="top" />
             </View>

              <View className="gap-3">
                <Text className={labelStyle}>Product Image *</Text>
                {imageUri || imageUrl ? (
                  <View className="gap-3">
                    <View className="aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                      <Image source={{ uri: imageUri || imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="disk" transition={200} />
                    </View>
                    {error ? <Text className="text-sm text-red-500 font-medium">{error}</Text> : null}
                    <PressableScale 
                      activeOpacity={0.8}
                      onPress={pickImage}
                      className={`py-3 px-4 rounded-xl items-center ${imageUploading ? "bg-slate-200 dark:bg-slate-800" : "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"}`}
                      disabled={imageUploading}
                    >
                      <Text className={`font-bold ${darkTheme ? "text-white" : "text-slate-900"}`}>{imageUploading ? "Uploading..." : "Change Image"}</Text>
                    </PressableScale>
                  </View>
                ) : (
                  <View className="gap-4">
                    <PressableScale 
                      activeOpacity={0.8}
                      onPress={pickImage}
                      className={`py-8 rounded-2xl border-2 border-dashed items-center justify-center ${imageUploading ? "bg-accentbg/10 border-accentbg" : "bg-slate-50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700"}`}
                      disabled={imageUploading}
                    >
                      <Ionicons name="cloud-upload-outline" size={32} color={BRAND.primary} className="mb-2" />
                      <Text className={`font-semibold ${darkTheme ? "text-slate-300" : "text-slate-600"}`}>
                        {imageUploading ? "Uploading..." : "Tap to upload image"}
                      </Text>
                    </PressableScale>
                    
                    <View className="flex-row items-center gap-4">
                      <View className={`flex-1 h-[1px] ${darkTheme ? "bg-slate-800" : "bg-slate-200"}`} />
                      <Text className={`text-xs font-semibold uppercase ${darkTheme ? "text-slate-500" : "text-slate-400"}`}>OR</Text>
                      <View className={`flex-1 h-[1px] ${darkTheme ? "bg-slate-800" : "bg-slate-200"}`} />
                    </View>

                    <TextInput 
                      className={inputStyle} 
                      placeholder="Paste Image URL" 
                      placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"} 
                      value={imageUrl} 
                      onChangeText={setImageUrl} 
                    />
                  </View>
                )}
              </View>

            <View className="flex-row gap-4">
              <View className="flex-1">
                <Text className={labelStyle}>Price (KSH) *</Text>
                <TextInput className={inputStyle} placeholder="150" placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"} value={price} onChangeText={setPrice} keyboardType="numeric" />
              </View>
              <View className="flex-1">
                <Text className={labelStyle}>Discount</Text>
                <TextInput className={inputStyle} placeholder="0" placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"} value={discount} onChangeText={setDiscount} keyboardType="numeric" />
              </View>
            </View>

            <View className="flex-row gap-4">
              <View className="flex-1">
                <Text className={labelStyle}>Capacity *</Text>
                <TextInput className={inputStyle} placeholder="20" placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"} value={capacity} onChangeText={setCapacity} keyboardType="numeric" />
              </View>
              <View className="flex-1">
                <Text className={labelStyle}>Unit</Text>
                <TextInput className={inputStyle} placeholder="L or ml" placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"} value={unit} onChangeText={setUnit} />
              </View>
            </View>
            
            <View>
              <Text className={labelStyle}>Stock Quantity *</Text>
              <TextInput className={inputStyle} placeholder="100" placeholderTextColor={darkTheme ? "#64748b" : "#94a3b8"} value={stock} onChangeText={setStock} keyboardType="numeric" />
            </View>

            <PressableScale
              activeOpacity={0.8}
              onPress={handleSubmit}
              disabled={loading}
              className={`py-4 rounded-2xl items-center mt-6 shadow-sm ${loading ? "bg-accentbg/60" : "bg-accentbg"}`}
            >
              <Text className="text-white font-bold text-lg">{loading ? "Saving..." : "Save Changes"}</Text>
            </PressableScale>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
