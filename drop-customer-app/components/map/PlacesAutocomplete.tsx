/**
 * PlacesAutocomplete — A lightweight, RN-compatible Google Places Autocomplete
 * replacement. Uses `fetch` instead of XMLHttpRequest to avoid the
 * `sendRequest` argument 7 crash on modern React Native / Expo SDK 54+.
 * No `uuid` dependency — avoids `crypto.getRandomValues()` errors.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	Keyboard,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
	type TextStyle,
	type ViewStyle,
} from "react-native";
import { Toast } from "@/lib/toast";
import { BRAND } from "@/constants/brandColors";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
interface PlacePrediction {
	place_id: string;
	description: string;
	structured_formatting?: {
		main_text: string;
		secondary_text: string;
	};
}

interface PlaceDetails {
	geometry: {
		location: { lat: number; lng: number };
	};
	formatted_address?: string;
	name?: string;
}

interface PlacesAutocompleteProps {
	/** Google Maps API key */
	apiKey: string;
	/** Placeholder text for the input */
	placeholder?: string;
	/** Called when the user selects a place */
	onPress: (data: PlacePrediction, details: PlaceDetails | null) => void;
	/** ISO language code */
	language?: string;
	/** Restrict results to a country (e.g. "country:ke") */
	components?: string;
	/** Whether to fetch full Place Details on selection */
	fetchDetails?: boolean;
	/** Minimum characters before triggering search */
	minLength?: number;
	/** Debounce delay in ms */
	debounce?: number;
	/** Dark theme flag for styling */
	darkTheme?: boolean;
	/** Custom styles */
	customStyles?: {
		container?: ViewStyle;
		textInput?: TextStyle;
		listView?: ViewStyle;
		row?: ViewStyle;
		description?: TextStyle;
		separator?: ViewStyle;
	};
	/** Custom placeholder text color */
	placeholderTextColor?: string;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
export default function PlacesAutocomplete({
	apiKey,
	placeholder = "Search for a location...",
	onPress,
	language = "en",
	components = "",
	fetchDetails = true,
	minLength = 2,
	debounce: debounceMs = 300,
	darkTheme = false,
	customStyles = {},
	placeholderTextColor,
}: PlacesAutocompleteProps) {
	const [text, setText] = useState("");
	const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
	const [showList, setShowList] = useState(false);
	const [loading, setLoading] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			abortRef.current?.abort();
			if (debounceTimer.current) clearTimeout(debounceTimer.current);
		};
	}, []);

	// ── Autocomplete search ──────────────────────────────────
	const fetchPredictions = useCallback(
		async (input: string) => {
			if (!input || input.length < minLength) {
				setPredictions([]);
				setShowList(false);
				return;
			}

			// Abort any in-flight request
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;

			setLoading(true);

			try {
				// 🔴 PRODUCTION GOOGLE MAPS MODE 
				/*
				const params = new URLSearchParams({
					input,
					key: apiKey,
					language,
				});
				if (components) params.append("components", components);

				const res = await fetch(
					`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
					{ signal: controller.signal }
				);
				const json = await res.json();

				if (json.status && json.status !== "OK" && json.status !== "ZERO_RESULTS") {
					console.warn("Places API Error:", json.status, json.error_message);
					if (json.status === "REQUEST_DENIED") {
						Toast.error("API Error", "Google Maps API request denied. Please check your API key and ensure Billing is enabled on Google Cloud.");
					}
				}

				if (json.predictions) {
					setPredictions(json.predictions);
					setShowList(json.predictions.length > 0);
				} else {
					setPredictions([]);
					setShowList(false);
				}
				*/

				// 🟢 FREE OPEN SOURCE MVP MODE 
				const bboxParam = components && components.includes("country:ke") ? "&bbox=33.9,-4.7,41.9,5.5" : "";
				const res = await fetch(
					`https://photon.komoot.io/api/?q=${encodeURIComponent(input)}&limit=5${bboxParam}`,
					{ signal: controller.signal }
				);
				const json = await res.json();

				if (json.features) {
					const mapped = json.features.map((feature: any, index: number) => {
						const props = feature.properties;
						const description = [props.name, props.street, props.city, props.state, props.country]
							.filter(Boolean)
							.join(", ");
						return {
							// Encode description into place_id to recover it in fetchPlaceDetails
							place_id: `${feature.geometry.coordinates[1]},${feature.geometry.coordinates[0]}_${index}_${encodeURIComponent(description)}`,
							description: description || "Unknown Location",
							structured_formatting: {
								main_text: props.name || props.street || "Unknown",
								secondary_text: [props.city, props.state, props.country].filter(Boolean).join(", "),
							}
						};
					});
					setPredictions(mapped);
					setShowList(mapped.length > 0);
				} else {
					setPredictions([]);
					setShowList(false);
				}
			} catch (e: any) {
				if (e.name !== "AbortError") {
					console.warn("PlacesAutocomplete: prediction fetch failed", e);
				}
			} finally {
				setLoading(false);
			}
		},
		[apiKey, language, components, minLength]
	);

	// ── Debounced input handler ──────────────────────────────
	const handleChangeText = useCallback(
		(value: string) => {
			setText(value);
			if (debounceTimer.current) clearTimeout(debounceTimer.current);
			debounceTimer.current = setTimeout(() => {
				fetchPredictions(value);
			}, debounceMs);
		},
		[debounceMs, fetchPredictions]
	);

	// ── Fetch Place Details ──────────────────────────────────
	const fetchPlaceDetails = useCallback(
		async (placeId: string): Promise<PlaceDetails | null> => {
			try {
				// 🔴 PRODUCTION GOOGLE MAPS MODE 
				/*
				const params = new URLSearchParams({
					place_id: placeId,
					key: apiKey,
					language,
				});
				const res = await fetch(
					`https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
				);
				const json = await res.json();
				if (json.result) return json.result as PlaceDetails;
				*/

				// 🟢 FREE OPEN SOURCE MVP MODE 
				const parts = placeId.split("_");
				const coords = parts[0];
				const addressPart = parts[2];
				
				if (coords) {
					const [lat, lng] = coords.split(",");
					if (lat && lng) {
						return {
							geometry: {
								location: { lat: parseFloat(lat), lng: parseFloat(lng) }
							},
							formatted_address: addressPart ? decodeURIComponent(addressPart) : undefined,
						};
					}
				}
			} catch (e) {
				console.warn("PlacesAutocomplete: details fetch failed", e);
			}
			return null;
		},

		[apiKey, language]
	);

	// ── Row press handler ────────────────────────────────────
	const handleSelect = useCallback(
		async (item: PlacePrediction) => {
			Keyboard.dismiss();
			setText(item.description);
			setShowList(false);
			setPredictions([]);

			if (fetchDetails) {
				const details = await fetchPlaceDetails(item.place_id);
				onPress(item, details);
			} else {
				onPress(item, null);
			}
		},
		[fetchDetails, fetchPlaceDetails, onPress]
	);

	// ── Styles ───────────────────────────────────────────────
	const defaultDark = darkTheme;
	const containerStyle: ViewStyle = {
		flex: 0,
		zIndex: 999,
		...customStyles.container,
	};
	const textInputStyle: TextStyle = {
		height: 48,
		borderRadius: 14,
		paddingHorizontal: 16,
		fontSize: 15,
		fontWeight: "600",
		backgroundColor: defaultDark ? "#1a1a1a" : "#fff",
		color: defaultDark ? "#fff" : "#000",
		borderWidth: 1,
		borderColor: defaultDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
		...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }),
		...customStyles.textInput,
	};
	const listViewStyle: ViewStyle = {
		position: "absolute",
		top: 52, // 48 (input) + 4 (margin)
		left: 0,
		right: 0,
		zIndex: 1000,
		borderRadius: 14,
		backgroundColor: defaultDark ? "#1a1a1a" : "#fff",
		borderWidth: 1,
		borderColor: defaultDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
		maxHeight: 220,
		...customStyles.listView,
	};
	const rowStyle: ViewStyle = {
		backgroundColor: defaultDark ? "#1a1a1a" : "#fff",
		padding: 14,
		...customStyles.row,
	};
	const descriptionStyle: TextStyle = {
		color: defaultDark ? "#e5e7eb" : "#374151",
		fontSize: 14,
		...customStyles.description,
	};
	const separatorStyle: ViewStyle = {
		height: StyleSheet.hairlineWidth,
		backgroundColor: defaultDark
			? "rgba(255,255,255,0.05)"
			: "rgba(0,0,0,0.05)",
		...customStyles.separator,
	};

	return (
		<View style={containerStyle}>
			<TextInput
				value={text}
				onChangeText={handleChangeText}
				placeholder={placeholder}
				placeholderTextColor={
					placeholderTextColor || (defaultDark ? "#6b7280" : "#9ca3af")
				}
				onFocus={() => {
					if (predictions.length > 0) setShowList(true);
				}}
				style={textInputStyle}
				returnKeyType="search"
				autoCorrect={false}
				onSubmitEditing={() => {
					if (predictions.length > 0) {
						handleSelect(predictions[0]);
					}
				}}
			/>

			{loading && (
				<View style={{ position: "absolute", right: 16, top: 14 }}>
					<ActivityIndicator size="small" color={defaultDark ? BRAND.white : BRAND.gray500} />
				</View>
			)}

			{showList && predictions.length > 0 && (
				<FlatList
					data={predictions}
					keyExtractor={(item) => item.place_id}
					style={listViewStyle}
					keyboardShouldPersistTaps="always"
					ItemSeparatorComponent={() => <View style={separatorStyle} />}
					renderItem={({ item }) => (
						<Pressable
							onPress={() => handleSelect(item)}
							style={({ pressed }) => [
								rowStyle,
								pressed && { opacity: 0.7 },
							]}
						>
							<Text style={descriptionStyle} numberOfLines={2}>
								{item.description}
							</Text>
						</Pressable>
					)}
				/>
			)}
		</View>
	);
}
