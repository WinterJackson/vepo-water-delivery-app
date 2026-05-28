import { View } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import React, { useContext } from "react";
import { UIThemeContext } from "@/context/ThemeContext";
import { BRAND } from "@/constants/brandColors";

type Props = {};

const BackButtonMinimal = (props: Props) => {
	const { currentTheme } = useContext(UIThemeContext);
	const darkTheme = currentTheme === "dark";
	return (
		<View
			className="rounded-full flex-row w-10 h-10 items-center justify-center"
			style={{
				backgroundColor: BRAND.primary,
				boxShadow: `2px 2px 20px ${darkTheme ? "#f1f1f140" : "#00000070"}`,
				zIndex: 20,
			}}
		>
			<View className="pr-1">
				<Ionicons name="chevron-back" size={24} color={BRAND.white} />
			</View>
		</View>
	);
};

export default BackButtonMinimal;
