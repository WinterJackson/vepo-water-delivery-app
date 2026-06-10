import React, { useContext } from "react";
import { View, Text, ScrollView, StatusBar, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { UIThemeContext } from "@/context/ThemeContext";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { BRAND } from "@/constants/brandColors";
import { Ionicons } from "@expo/vector-icons";
import { useRiderReviews } from "@/hooks/queries/useRiderData";
import { RiderReviewsSkeleton } from "@/components/skeletons/ContextualSkeletons";

export default function Reviews() {
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const router = useRouter();
  const { data: reviewsData, isLoading } = useRiderReviews();

  const renderDistributionBar = (stars: number, count: number, total: number) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    return (
      <View key={stars} className="flex-row items-center mb-2">
        <Text className={`w-4 font-bold ${darkTheme ? "text-gray-300" : "text-gray-600"}`}>{stars}</Text>
        <Ionicons name="star" size={12} color="#F59E0B" style={{ marginRight: 8 }} />
        <View className="flex-1 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <View className="h-full bg-yellow-500 rounded-full" style={{ width: `${percentage}%` }} />
        </View>
        <Text className={`w-8 text-right text-xs ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>{count}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView className={`flex-1 ${darkTheme ? "bg-black" : ""}`}>
      <StatusBar translucent backgroundColor={darkTheme ? "black" : "white"} barStyle={darkTheme ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={{ overflow: "hidden", paddingBottom: 4, zIndex: 30 }}>
          <View 
              className="flex-row items-center px-4 py-3 pb-4 mb-2"
              style={{ 
                  backgroundColor: darkTheme ? BRAND.bgDark : BRAND.white,
                  borderBottomWidth: 1, 
                  borderBottomColor: darkTheme ? BRAND.gray800 : BRAND.gray200,
                  ...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 })
              }}
          >
              <TouchableOpacity onPress={() => router.back()} className="mr-4">
                  <BackButtonMinimal />
              </TouchableOpacity>
              <Text className={`text-xl font-bold ${darkTheme ? "text-white" : "text-black"}`}>
                  Customer Feedback
              </Text>
          </View>
      </View>

      {isLoading ? (
          <RiderReviewsSkeleton />
      ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }} className="flex-1 px-4 pt-2">
            {/* Overall Rating Card */}
            <View className={`w-full rounded-2xl p-5 border flex-row items-center justify-between mb-6 ${darkTheme ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
                <View className="items-center mr-6">
                    <Text className={`text-5xl font-bold ${darkTheme ? "text-white" : "text-black"}`}>
                        {reviewsData?.average_rating?.toFixed(1) || "5.0"}
                    </Text>
                    <View className="flex-row my-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Ionicons 
                                key={i} 
                                name={i <= Math.round(reviewsData?.average_rating || 5) ? "star" : "star-outline"} 
                                size={16} 
                                color="#F59E0B" 
                            />
                        ))}
                    </View>
                    <Text className={`text-xs ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                        {reviewsData?.total_reviews || 0} Ratings
                    </Text>
                </View>

                <View className="flex-1">
                    {[5, 4, 3, 2, 1].map((star) => 
                        renderDistributionBar(star, reviewsData?.distribution?.[star] || 0, reviewsData?.total_reviews || 0)
                    )}
                </View>
            </View>

            <Text className={`text-xl font-bold mb-4 ${darkTheme ? "text-white" : "text-black"}`}>
                Recent Comments
            </Text>

            {reviewsData?.reviews && reviewsData.reviews.filter(r => r.comment).length > 0 ? (
                reviewsData.reviews.filter(r => r.comment).map((review) => (
                    <View key={review.id} className={`p-4 rounded-xl mb-3 border ${darkTheme ? "bg-white/5 border-white/10" : "bg-white border-gray-100 shadow-sm"}`}>
                        <View className="flex-row justify-between items-center mb-2">
                            <View className="flex-row">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Ionicons 
                                        key={i} 
                                        name={i <= review.rating ? "star" : "star-outline"} 
                                        size={14} 
                                        color="#F59E0B" 
                                    />
                                ))}
                            </View>
                            <Text className={`text-xs ${darkTheme ? "text-gray-500" : "text-gray-400"}`}>
                                {review.created_at ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(review.created_at)) : 'Recent'}
                            </Text>
                        </View>
                        <Text className={`text-base ${darkTheme ? "text-gray-300" : "text-gray-700"}`}>
                            "{review.comment}"
                        </Text>
                    </View>
                ))
            ) : (
                <View className="items-center justify-center py-10">
                    <Ionicons name="chatbubble-ellipses-outline" size={48} color={BRAND.primary} />
                    <Text className={`mt-4 text-center ${darkTheme ? "text-gray-400" : "text-gray-500"}`}>
                        No written comments yet. Keep providing great service!
                    </Text>
                </View>
            )}

          </ScrollView>
      )}
    </SafeAreaView>
  );
}
