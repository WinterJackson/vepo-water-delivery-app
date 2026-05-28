import { View, Text, TextInput, Image } from "react-native";
import React, { useContext, useEffect, useRef } from "react";
import { UIThemeContext } from "@/context/ThemeContext";
import { BRAND } from "@/constants/brandColors";

type Props = {
	width: string;
	height: string;
	buttonStyle: string;
	setFunc: (value: string) => void;
};

const SearchBar = ({ width, buttonStyle, height, setFunc }: Props) => {
	const inputRef = useRef<TextInput>(null);
	const {currentTheme} = useContext(UIThemeContext);
	const darkTheme = currentTheme === "dark"

	useEffect(() => {
		const timeout = setTimeout(() => {
			inputRef.current?.focus();
		}, 100); // Delay is sometimes needed to ensure the keyboard opens smoothly

		return () => clearTimeout(timeout);
	}, []);

	return (
		<View
			className={`px-4 flex-1 ${darkTheme ? "bg-gray-200/20" : "bg-white"} rounded-full ${width} ${height}`}
		>
			<TextInput
				ref={inputRef}
				placeholder="Search for products or vendors"
				placeholderTextColor={darkTheme ? BRAND.searchPlaceholderDark : BRAND.searchPlaceholderLight}
				className="flex-1"
				style={{
					color: darkTheme ? BRAND.searchPlaceholderDark : BRAND.searchPlaceholderLight
				}}
				enterKeyHint={"search"}
				onChangeText={(text) => setFunc(text)}
			/>
		</View>
	);
};

export default SearchBar;
