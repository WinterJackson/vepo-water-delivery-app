import { View, Text, Image } from "react-native";
import React, { useContext, useState } from "react";
import { UIThemeContext } from "@/context/ThemeContext";
import { PressableScale } from "@/components/ui/PressableScale";
import { useTargetReviews } from "@/hooks/queries/useReviews";

const ReviewCard = ({ review, darkTheme }: { review: any; darkTheme: boolean }) => {
  const [extend, setExtend] = useState(false);
  const comment = review.comment || "";
  return (
    <View className="p-2 py-4 gap-2 border-b border-accentbg/20 mx-1">
      <Text className={`text-lg text-wrap ${darkTheme ? "text-white" : "text-black"}`}>
        {comment.length > 70 && !extend ? comment.substring(0, 70).trim() + "..." : comment}
      </Text>
      {comment.length > 70 && (
        <PressableScale onPress={() => setExtend(!extend)}>
          <Text className="text-sm text-gray-500">{extend ? "less" : "more"}</Text>
        </PressableScale>
      )}
      <View className="flex-row justify-between gap-2">
        <Text className="text-gray-400 text-sm">{new Date(review.created_at).toLocaleDateString()}</Text>
        <View className="flex-row gap-0">
          {Array.from({ length: Math.round(review.rating) }).map((_, i) => <Text key={i}>⭐</Text>)}
        </View>
      </View>
    </View>
  );
};

const Reviews = ({ targetType, targetId }: { targetType: "vendor" | "rider"; targetId: string }) => {
  const { currentTheme } = useContext(UIThemeContext);
  const darkTheme = currentTheme === "dark";
  const { data: reviews = [], isLoading } = useTargetReviews(targetType, targetId);

  if (isLoading) return null; // Or a skeleton later
  
  if (reviews.length === 0) {
    return (
      <View className="pt-8 p-1 gap-2">
        <Text className={darkTheme ? "text-xl text-white" : "text-xl"}>Reviews</Text>
        <Text className={darkTheme ? "text-gray-400" : "text-gray-500"}>No reviews yet.</Text>
      </View>
    );
  }
  
  return (
    <View className="pt-8 p-1 gap-2">
      <Text className={darkTheme ? "text-xl text-white" : "text-xl"}>Reviews</Text>
      <View className="p-1 pb-4 bg-accentbg/5 flex-1 rounded-3xl">
        {reviews.map((r: any) => <ReviewCard key={r.id} review={r} darkTheme={darkTheme} />)}
      </View>
    </View>
  );
};

export default Reviews;
