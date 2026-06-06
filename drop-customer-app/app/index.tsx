import React, { useContext, useEffect, useState } from "react";
import { View, Text, Image } from "react-native";
import { StatusBar } from "expo-status-bar";
import Modal from "react-native-modal";
import * as Location from "expo-location";
import { Redirect, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";

import { AnimatedSplash } from "@/components/splash/AnimatedSplash";
import { PressableScale } from "@/components/ui/PressableScale";
import { UIThemeContext } from "@/context/ThemeContext";
import { useUpdateLocation } from "@/hooks/queries/useUser";
import { ROUTES } from "@/API/routes/ApiRoutes";
import { BRAND, TOAST } from "@/constants/brandColors";
import { Ionicons } from "@expo/vector-icons";

export default function Index() {
	const router = useRouter();
	const { currentTheme } = useContext(UIThemeContext);
	const darkTheme = currentTheme === "dark";
	const { getToken, isSignedIn, isLoaded } = useAuth();

	// ── State ──
	const [splashComplete, setSplashComplete] = useState(false);
	const [ShowLocationPrompt, setShowLocationPrompt] = useState(false);
	const [LocationFinal, setLocation] = useState<Location.LocationObject | null>(null);
	const [isVerifyingProfile, setIsVerifyingProfile] = useState(false);
	const [readyToRoute, setReadyToRoute] = useState<"onboarding" | "main" | null>(null);

	// ── Location update ──
	const { mutateAsync: mutateLocation } = useUpdateLocation();

	const updateUserLocation = async () => {
		if (!LocationFinal) return;
		try {
			await mutateLocation({
				lat: LocationFinal.coords.latitude,
				lng: LocationFinal.coords.longitude,
			});
		} catch (error) {
			// Silent — location update is non-blocking
		}
	};

	async function getCurrentLocation() {
		setShowLocationPrompt(false);
		try {
			let { status } = await Location.requestForegroundPermissionsAsync();
			if (status !== "granted") return;
			let location = await Location.getCurrentPositionAsync({});
			setLocation(location);
		} catch (error: unknown) {
			setShowLocationPrompt(true);
		}
	}

	// Fire location + update AFTER splash completes and user is signed in
	useEffect(() => {
		const verifyOnboardingAndProceed = async () => {
			if (!isSignedIn) return;
			setIsVerifyingProfile(true);
			try {
				const token = await getToken();
				const res = await fetch(ROUTES.GET_PROFILE_STATUS("customer"), {
					headers: { Authorization: `Bearer ${token}` }
				});
				if (res.ok) {
					const data = await res.json();
					if (!data.exists || (data.missing_fields && data.missing_fields.length > 0)) {
						setReadyToRoute("onboarding");
					} else {
						setReadyToRoute("main");
					}
				} else {
					// Backend returned error - safer to route to onboarding where user creation happens
					setReadyToRoute("onboarding");
				}
			} catch (e) {
				// Network failure - safer to route to onboarding where user creation happens
				setReadyToRoute("onboarding");
			} finally {
				setIsVerifyingProfile(false);
			}
		};

		if (splashComplete && isLoaded) {
			if (isSignedIn) {
				verifyOnboardingAndProceed();
				getCurrentLocation().catch(() => {});
			}
		}
	}, [splashComplete, isLoaded, isSignedIn]);

	useEffect(() => {
		if (LocationFinal != null) {
			updateUserLocation().catch(() => {});
		}
	}, [LocationFinal]);

	// ── Splash gate ──
	// Show splash until both the animation completes AND Clerk auth resolves.
	// We also wait for the profile verification to finish cleanly if they are signed in.
	const canProceed = splashComplete && isLoaded;
	const isFullyReady = canProceed && (!isSignedIn || readyToRoute !== null);

	if (!isFullyReady) {
		return (
			<AnimatedSplash
				variant="customer"
				isDark={darkTheme}
				onComplete={() => setSplashComplete(true)}
			/>
		);
	}

	// ── Location permission modal (functional, shows after splash) ──
	if (ShowLocationPrompt) {
		return (
			<>
				<StatusBar
					style={darkTheme ? "light" : "dark"}
					backgroundColor={darkTheme ? "black" : "#f0f0f0"}
				/>
				<View
					className={`flex-1 ${darkTheme ? "bg-black" : "bg-[#f0f0f0]"} w-full items-center justify-center`}
				>
					<Modal isVisible={ShowLocationPrompt}>
						<View className="items-center">
							<View className="bg-white w-[80%] gap-6 max-w-[300px] rounded-3xl p-6">
								<View className="flex-row gap-3">
									<Ionicons name="locate" size={24} color={BRAND.primary} />
									<Text className="font-semibold text-2xl text-blue-500">
										Location Access
									</Text>
								</View>
								<View>
									<Text>
										This app requires access to your current location for it to
										work properly.
									</Text>
									<Text>
										Please grant permission to access your location in order to
										proceed
									</Text>
									<Text>
										If you have allowed location permission and are still getting
										this prompt it might be a Network issue so Please check your
										Network settings
									</Text>
								</View>
								<PressableScale
									activeOpacity={0.8}
									onPress={() => getCurrentLocation()}
								>
									<View className="bg-blue-500 p-3 px-6 rounded-xl items-center">
										<Text className="text-white font-bold">
											Allow Location Access
										</Text>
									</View>
								</PressableScale>
							</View>
						</View>
					</Modal>
				</View>
			</>
		);
	}

	// ── Route to correct destination ──
	if (isSignedIn) {
		if (readyToRoute === "onboarding") return <Redirect href={"/(Auth)/Onboarding" as any} />;
		return <Redirect href={"/(screens)" as any} />;
	} else {
		return <Redirect href={"/(Auth)" as any} />;
	}
}
