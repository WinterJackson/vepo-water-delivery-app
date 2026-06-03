import { View, Text, Image } from "react-native";
import React, { useContext, useState } from "react";
import { DarkTheme } from "@react-navigation/native";
import { UIThemeContext } from "@/context/ThemeContext";
import { PressableScale } from "@/components/ui/PressableScale";

type Props = {};

const Reviews = (props: Props) => {
  const {currentTheme} = useContext(UIThemeContext);
	const darkTheme = currentTheme === "dark"


  // DUMMY DATA
  const reviews = [1, 2, 3, 4, 5, 6, 7];
  const rating = [1, 2, 3, 4];
  const likes = 3;
  const comment =
    "Lorem, ipsum dolor sit amet consectetur adipisicing elit. In natus, cupiditate repellendus neque soluta nemo unde deserunt suscipit ea";
  return (
    <View className="pt-8 p-1 gap-2 ">
      <View className="flex-row justify-between items-center">
        <Text className={darkTheme? "text-xl text-white" : "text-xl"}>{"Reviews"}</Text>
        <Text className={"text-lg text-gray-500"}>{`Avg Rating:  ⭐${"4.6"}`}</Text>
      </View>
      <View className={`p-1 pb-4 ${darkTheme? "bg-accentbg/5":"bg-accentbg/5"} flex-1 rounded-3xl `}>
        <View className="flex-row items-center gap-2 flex-1 p-3 border-b border-accentbg/20 justify-end">
          <Text className="text-gray-500">{`Sort by`}</Text>
          <Image
            source={require("../../assets/icons/filter-black.png")}
            className="w-5 h-5"
            tintColor={darkTheme ? "white" : "black"}
          />
        </View>
        {reviews.map((i, index) => {
          const [extend, setextend] = useState(false);
          return (
            <View
              key={index}
              className="p-2 py-4 gap-2 border-b border-accentbg/20 mx-1"
            >
              {/* <------------------------------------<TOP [ MESSAGE, LIKE BUTTON ]>------------------------------------> */}
              <View className="min-h-[40px] flex-row justify-between items-start gap-3">
                {/* REVIEW TEXT */}
                <View className="flex-1">
                  <Text>
                    {/* <Text className={"text-lg text-wrap"}>{`${
                        comment.length > 70 && !extend
                          ? comment.substring(0, 70).trim() + "..."
                          : comment
                      }</Text> */}
                    <Text className={`text-lg text-wrap ${darkTheme ? "text-white" : "text-black"}`}>{
                        comment.length > 70 && !extend
                          ? comment.substring(0, 70).trim() + "..."
                          : comment
                      }</Text>
                    {/* <Text className={'text-sm text-gray-500'}>{`more`}</Text> */}
                    <PressableScale onPress={() => setextend(!extend)}>
                      <Text className="text-sm text-gray-500">
                        {extend ? " ...less" : "more"}
                      </Text>
                    </PressableScale>
                  </Text>
                </View>
                {/* LIKE REVIEW */}
                <PressableScale>
                  <View className="flex-row items-end gap-2">
                    <Image
                      source={require("../../assets/icons/thumbs-up-black.png")}
                      className="w-5 h-5"
                      tintColor={"gray"}
                    />
                    <Text className={"text-gray-500"}>{`${likes > 0 ? likes.toString() : ""}`}</Text>
                  </View>
                </PressableScale>
              </View>

              {/* <---------------------------------<MIDDLE [ DATE, NAME, STAR RATING  ]>--------------------------------> */}
              <View className="flex-row justify-between gap-2">
                {/* DATE AND NAME  */}
                <Text className="text-gray-400 text-sm">{`${"25-4-2025"}`}</Text>
                {/* RATING */}
                <View className="flex-row gap-0">
                  {rating.map((i, index) => {
                    return <Text key={index}>⭐</Text>;
                  })}
                </View>
              </View>

              {/* <----------------------------------------<BOTTOM [ verified  ]>----------------------------------------> */}
              <View className="flex-row gap-2 items-center justify-end">
                <Image
                  source={require("../../assets/icons/verified-black.png")}
                  className="w-5 h-5"
                  tintColor={"lightgreen"}
                />
                <Text className={" text-sm text-green-400"}>{"Verified purchase"}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default Reviews;
