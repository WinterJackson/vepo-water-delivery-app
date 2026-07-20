// export const unstable_settings = {
//   animation: "slide_from_right",
// };

import {
	View,
	Text,
	Image,
	ScrollView,
	Dimensions,
	TouchableOpacity,
	StatusBar,
	ImageBackground,
	Modal,
	StyleSheet,
	ActivityIndicator,
} from "react-native";
import React, { useContext, useEffect, useState, useRef, useCallback } from "react";
import { BRAND } from "@/constants/brandColors";
import { randomUUID } from 'expo-crypto';
//   import { StatusBar } from "expo-status-bar";
import BackButton from "@/components/ui/BackButton";
import CartItem from "@/components/common/CartItem";
import { CartItemSkeleton } from "@/components/skeletons/ContextualSkeletons";
import { EmptyState } from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { useRouter } from "expo-router";
import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { UIThemeContext } from "@/context/ThemeContext";
import BackButtonMinimal from "@/components/ui/BackButtonMinimal";
import { useAuth } from "@clerk/clerk-expo";
import ApiRoutes from "@/API/routes/ApiRoutes";
import images from "@/constants/images/images";
import Context from "@/context/context";
import { TextInput } from "react-native";
import { ROUTES } from "@/API/routes/ApiRoutes";
import { Toast } from "@/lib/toast";
import { useUserDetails } from "@/hooks/queries/useUser";
import { useDetailedCart, useDeliveryFee } from "@/hooks/queries/useCart";
import { RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DataFallbackUI } from "@/components/ui/DataFallbackUI";

const { width, height } = Dimensions.get("screen");

export default function Cart() {
	// <--------------HOOKS---------------->
	const router = useRouter();
	const { fetchCart } = useContext(Context)
	const { data: User } = useUserDetails()
	const {currentTheme} = useContext(UIThemeContext);
	const darkTheme = currentTheme === "dark"
	const { getToken, signOut } = useAuth()
	const [deliveryType, setDeliveryType] = useState<'quick_swap' | 'keep_my_bottle'>('quick_swap');
	
	// <--------------REACT QUERY-------------->
	const { data: Cart, isLoading: isCartLoading, refetch: refetchCart, isRefetching } = useDetailedCart();
	
	const total_quantity = Cart?.cart_item?.reduce((acc: number, item: any) => acc + item.quantity, 0) || 0;
	let vehicle_class = "motorbike";
	if (total_quantity > 20) vehicle_class = "truck";
	else if (total_quantity > 4) vehicle_class = "tuktuk";
	
	const vendor_type = Cart?.cart_item?.[0]?.product?.vendor?.vendor_type || 'retail_refill';

	const { data: deliveryFeeData } = useDeliveryFee(
		Cart?.cart_item?.[0]?.product?.vendor?.lat || User?.lat, 
		Cart?.cart_item?.[0]?.product?.vendor?.lng || User?.lng,
		User?.lat, 
		User?.lng, 
		vendor_type,
		vehicle_class,
		deliveryType
	);
	
	// <--------------STATES--------------->
	const [ modalPage , setModalPage ]= useState(1)
	const [CheckoutVisible, setCheckoutVisible] = useState(false)
	const [CheckoutRequestID, setCheckoutRequestID] = useState(null)
	
	const [PhoneNumber, setPhoneNumber] = useState<string | null>(() => {
		if (User?.phone) {
			let cleaned = User.phone.replace(/[^0-9]/g, '');
			if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
			if (cleaned.startsWith('254')) cleaned = cleaned.substring(3);
			return cleaned;
		}
		return null;
	});

	useEffect(() => {
		if (User?.phone && !PhoneNumber) {
			let cleaned = User.phone.replace(/[^0-9]/g, '');
			if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
			if (cleaned.startsWith('254')) cleaned = cleaned.substring(3);
			setPhoneNumber(cleaned);
		}
	}, [User?.phone]);
	const [PaymentLoading, setPaymentLoading] = useState(false)
	const [ConfirmPaymentLoading, setConfirmPaymentLoading] = useState(false)
	const [SuccessModal, setSuccessModal] =useState(false)
	const [ErrorMessage, setErrorMessage] =useState("")
	const [ErrorModal, setErrorModal] =useState(false)
	const [PaymentMethod, setPaymentMethod ] = useState<string | null>(null) // mpesa or card/stripe
	const [idempotencyKey, setIdempotencyKey] = useState<string>(() => randomUUID())
	const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
	// <-------------VARIABLES------------->
	const deliveryFee = deliveryFeeData?.delivery_fee ?? deliveryFeeData?.fee ?? 50;
	const quickSwapFee = deliveryFeeData?.quick_swap_fee ?? 50;
	const keepMyBottleFee = deliveryFeeData?.keep_my_bottle_fee ?? 50;
	const deliveryPremium = Math.max(0, keepMyBottleFee - quickSwapFee);

	const CartLoaded = !isCartLoading;
	
	// --- Anti-Fraud Surcharges & Wallet ---
	const payload_surcharge = total_quantity > 2 ? (total_quantity - 2) * 10.0 : 0;
	const floor_level = User?.floor_level || 0;
	const has_elevator = User?.has_elevator || false;
	const staircase_surcharge = (floor_level > 2 && !has_elevator) ? (floor_level - 2) * 10.0 : 0;
	const serviceFee = Cart?.service_fee ?? (vendor_type === "wholesale_b2b" ? 50.0 : 12.0);
	const subtotal = Cart?.total_with_deposit ?? Cart?.total_amount ?? 0;
	
	// --- Bottle Deposit & Welcome Offer ---
	let bottle_fee_total = 0.0;
	let welcome_discount = 0.0;
	const isFirstTimeUser = User && !User.has_used_welcome_offer;

	if (deliveryType === 'keep_my_bottle' || isFirstTimeUser) {
		let highest_bottle_price = 0.0;
		Cart?.cart_item?.forEach((item: any) => {
			const capacity = item?.product?.capacity || 0;
			if (capacity === 20) {
				bottle_fee_total += 300.0 * item.quantity;
				highest_bottle_price = Math.max(highest_bottle_price, 300.0);
			} else if (capacity === 10) {
				bottle_fee_total += 150.0 * item.quantity;
				highest_bottle_price = Math.max(highest_bottle_price, 150.0);
			}
		});
		
		if (isFirstTimeUser && highest_bottle_price > 0) {
			welcome_discount = bottle_fee_total * 0.30;
		}
	}
	
	const pre_discount = subtotal + bottle_fee_total - welcome_discount + deliveryFee + serviceFee + payload_surcharge + staircase_surcharge;
	const max_discount = Math.max(0, pre_discount - 1.0);
	const wallet_discount = Math.min(User?.wallet_balance || 0, max_discount);
	const finalTotal = pre_discount - wallet_discount;

	// <-------------FUNCTIONS------------->
	// API CALLS
	const fetch_cart = useCallback(async () => {
		await refetchCart();
	}, [refetchCart]);
// console.log(Cart)
	const Checkout = async () => {
		if (!User?.lat || !User?.lng || (User.lat === 0 && User.lng === 0)) {
			Toast.error("Missing Location", "Please set your delivery location on the map before checking out.");
			return;
		}
		// CRIT-03: Validate phone number format before checkout
		const fullPhone = PhoneNumber ? `254${PhoneNumber}` : null;
		if (!fullPhone || fullPhone.length < 12 || fullPhone.length > 13) {
			Toast.error("Invalid Phone", "Please enter a valid Kenyan phone number.");
			return;
		}
		setPaymentLoading(true)
		const token = await getToken()
		// CRIT-01: Only send cart ID and phone — backend derives user from JWT token
		// CRIT-04: Guard against NaN by defaulting to 0
		const payload = {
			phone : fullPhone,
			amount : Math.ceil(finalTotal),
			id : Cart?.id,
			user_id: User?.id,
			lat: User?.lat ?? 0,
			lng: User?.lng ?? 0,
			delivery_type: vendor_type === "wholesale_b2b" ? "standard" : deliveryType,
			payment_method: PaymentMethod || "mpesa"
		}
		try {
			const apiCall = await fetch(ApiRoutes.Checkout.path, {
				method : ApiRoutes.Checkout.method,
				headers: {
					"Authorization" : `Bearer ${token}`,
					"Content-Type" : "application/json",
					"Idempotency-Key" : idempotencyKey
				},
				body : JSON.stringify(payload)
			})
			const response = await apiCall.json()
			if (!apiCall.ok) {
				if (apiCall.status === 401) {
					Toast.error("Session Expired", "Please log in again to continue.");
					signOut();
					router.replace("/(Auth)/sign-in/screen");
				} else if (apiCall.status === 400) {
					setErrorMessage(response?.detail || "Your delivery address exceeds the allowed distance. Please update your location.");
					setErrorModal(true);
					setCheckoutVisible(false);
				} else {
					Toast.error("Checkout Failed", response?.detail || "Please try again.");
				}
				setPaymentLoading(false);
				return;
			}
			
			if (response.payment_method === "cash") {
				// Cash orders are completed immediately without polling
				fetch_cart()
				fetchCart()
				setPaymentLoading(false)
				setCheckoutVisible(false)
				router.push("/(screens)/order-confirmation")
				return;
			}
			
			setCheckoutRequestID(response.CheckoutRequestID)
			fetch_cart()
			fetchCart()
			setPaymentLoading(false)
			nextPage()
			setModalPage(3)
		} catch (error: unknown) {
			if (__DEV__) console.error("Checkout error:", (error as Error)?.message);
			Toast.error("Network Error", "Could not reach payment server.");
			setPaymentLoading(false)
		}
	}

	// CRIT-02: isManualConfirm flag distinguishes manual confirm from auto-poll
	const confirmTransaction = async (isManualConfirm = false) => {
		setConfirmPaymentLoading(true)
		const token = await getToken()
		const payload = {
			CheckoutRequestID
		}
		try {
			const apiCall = await fetch( ApiRoutes.ConfirmPayment.path, {
				method : ApiRoutes.ConfirmPayment.method,
				headers : {
					"Authorization" : `Bearer ${token}`,
					"Content-Type" : "application/json"
				},
				body : JSON.stringify(payload)
			})
			const response = await apiCall.json()
			if(response.code == "0"){
				// SUCCESS: Clear polling, close checkout, show success
				if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
				if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
				setCheckoutVisible(false)
				setIdempotencyKey(randomUUID());
				setConfirmPaymentLoading(false)
				router.push("/(screens)/order-confirmation")
			} else {
				// PENDING/FAIL from auto-poll: only stop polling on manual confirm
				if (isManualConfirm) {
					if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
					if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
					setCheckoutVisible(false)
					setErrorMessage(response.message || "Payment not confirmed. Please check your M-Pesa messages.")
					setErrorModal(true)
				}
				// Auto-poll: let the interval continue retrying
				setConfirmPaymentLoading(false)
			}
		} catch (error: unknown) {
			if (__DEV__) console.error("Confirm error:", (error as Error)?.message);
			if (isManualConfirm) {
				Toast.error("Verification Failed", "Could not verify payment.");
				if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
				if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
			}
			setConfirmPaymentLoading(false)
		}
	}

	// CRIT-05: Auto-poll M-Pesa confirmation with 60s timeout
	useEffect(() => {
		if (!CheckoutRequestID || modalPage !== 3) return;

		// Poll every 5 seconds
		pollingIntervalRef.current = setInterval(() => {
			confirmTransaction();
		}, 5000);

		// Timeout after 60 seconds
		pollingTimeoutRef.current = setTimeout(() => {
			if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
			setConfirmPaymentLoading(false);
			Toast.error("Payment Timeout", "We couldn't verify your payment. Check your M-Pesa messages and try confirming again.");
		}, 60000);

		return () => {
			if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
			if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
		};
	}, [CheckoutRequestID, modalPage]);



	// ANIMATIONS 
	const translateX = useSharedValue(0)

	const animatedTranslateX = useAnimatedStyle(()=>({
		transform: [{translateX: translateX.value}]
	}))

	const nextPage = ()=>{
		if (translateX.value != -width*2){
			translateX.value = withTiming(translateX.value - width, {duration: 500} )
		}
	}

	const prevPage = ()=>{
		if (translateX.value != 0){
			translateX.value = withTiming(translateX.value + width, {duration: 500} )
		}
	}

	const initialPage = ()=>{
		if (translateX.value != 0){
			translateX.value = withTiming(0, {duration: 500} )
		}
	}

	useEffect(()=>{
		fetch_cart()
	},[])

	if (!User && !isCartLoading) {
		return (
			<DataFallbackUI 
				title="User data unavailable"
				message="We couldn't load your profile required for checkout. Please retry or go home."
				onRetry={() => fetch_cart()}
			/>
		);
	}

	return (
		<>
			<StatusBar
				translucent
				backgroundColor={darkTheme?"black":"white"}
				barStyle={darkTheme?"light-content":"dark-content"}
			/>

			<SafeAreaView className={`flex-1 w-full ${darkTheme?"bg-black":""}`}>
				<Animated.View 
					className="flex-1 pb-2"
					style={{
								marginBottom: 50,
							}}
				>
					<View style={{ overflow: "hidden", paddingBottom: 4 }}>
					<View 
						className={`flex-row items-center px-5 py-3 pb-4 mb-2 z-30`}
						style={{ 
							backgroundColor: darkTheme ? "#000" : "#fff",
							borderBottomWidth: 1, 
							borderBottomColor: darkTheme ? BRAND.gray800 : BRAND.gray200,
							...(darkTheme ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 })
						}}
					>
						<TouchableOpacity
							className="mr-4 z-10"
							onPress={() => router.back()}
							activeOpacity={0.6}
						>
							<BackButtonMinimal/>
						</TouchableOpacity>
						<Text className={`text-xl font-bold tracking-tight ${darkTheme?"text-white":"text-black"}`}>Your Cart</Text>
					</View>
					</View>
					<View className="flex-1 gap-3">
						<ScrollView
							className="flex-1"
							showsVerticalScrollIndicator={false}
							overScrollMode="never"
							snapToAlignment="start"
							contentContainerStyle={{ paddingBottom: 120 }}
							scrollEventThrottle={16}
							refreshControl={
								<RefreshControl
									refreshing={isRefetching}
									onRefresh={refetchCart}
									tintColor={darkTheme ? "white" : "black"}
									colors={[BRAND.primary]}
								/>
							}
							>
							
							{CartLoaded && Cart === undefined ? (
								<View className="mt-10 flex-1">
									<EmptyState 
										mood="sad" 
										title="Your cart is empty" 
										subtitle="You've not yet added anything to your cart." 
										ctaLabel="Continue Shopping"
										onCtaPress={() => router.push("/(screens)")}
									/>
								</View>
							):(
								<View className="min-h-full  p-4 gap-5 ">
									{/* Cart Header */}

									{/* Cart Items */}
									<View className="gap-4">
										{!CartLoaded ? (
											[...Array(3)].map((_, index) => (
												<CartItemSkeleton key={index} />
											))
											): (
												Cart?.cart_item?.map((item: any) => {
													return(
													<CartItem data={item} key={item.id} func={fetch_cart}  />
													)
												})
											)}
									</View>

									{/* Delivery Type Selection */}
									{CartLoaded && Cart?.cart_item?.length > 0 && vendor_type !== 'wholesale_b2b' && (
										<View className={`w-full gap-3 p-5 rounded-[24px] mt-2 mb-2 ${darkTheme ? "bg-[#1B1F24]" : "bg-white border border-gray-100"}`}>
											<Text className={`text-lg font-bold ${darkTheme ? 'text-white' : 'text-black'}`}>Delivery Option</Text>
											
											<TouchableOpacity 
												activeOpacity={0.7}
												onPress={() => setDeliveryType('quick_swap')}
												className={`w-full p-4 rounded-xl border-2 mb-2 ${deliveryType === 'quick_swap' ? 'border-primary bg-primary/10' : (darkTheme ? 'border-gray-800 bg-[#0e0e0e]' : 'border-gray-200 bg-white')}`}
											>
												<View className="flex-row justify-between items-center">
													<View className="flex-col max-w-[80%]">
														<Text className={`text-base font-bold ${darkTheme ? 'text-white' : 'text-black'}`}>Quick Swap</Text>
														<Text className={`text-xs mt-1 ${darkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Give your empty bottle to the rider. Standard delivery fee.</Text>
													</View>
													<View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${deliveryType === 'quick_swap' ? 'border-primary' : 'border-gray-400'}`}>
														{deliveryType === 'quick_swap' && <View className="w-3 h-3 rounded-full bg-primary" />}
													</View>
												</View>
											</TouchableOpacity>

											<TouchableOpacity 
												activeOpacity={0.7}
												onPress={() => setDeliveryType('keep_my_bottle')}
												className={`w-full p-4 rounded-xl border-2 ${deliveryType === 'keep_my_bottle' ? 'border-primary bg-primary/10' : (darkTheme ? 'border-gray-800 bg-[#0e0e0e]' : 'border-gray-200 bg-white')}`}
											>
												<View className="flex-row justify-between items-center">
													<View className="flex-col max-w-[80%]">
														<Text className={`text-base font-bold ${darkTheme ? 'text-white' : 'text-black'}`}>Keep My Bottle</Text>
														<Text className={`text-xs mt-1 ${darkTheme ? 'text-gray-400' : 'text-gray-500'}`}>You don't have an empty bottle to return. +KSH {deliveryPremium.toFixed(0)} delivery premium.</Text>
													</View>
													<View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${deliveryType === 'keep_my_bottle' ? 'border-primary' : 'border-gray-400'}`}>
														{deliveryType === 'keep_my_bottle' && <View className="w-3 h-3 rounded-full bg-primary" />}
													</View>
												</View>
											</TouchableOpacity>
										</View>
									)}

									{/* Total */}
									{
										CartLoaded && Cart?.cart_item?.length > 0 && (
											<View className={`w-full gap-3 p-5 rounded-[24px] mt-2 mb-4 ${darkTheme ? "bg-[#1B1F24]" : "bg-white border border-gray-100"}`}>
												<View className="flex-row justify-between items-center">
													<Text className={`text-base font-medium ${darkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
														Subtotal
													</Text>
													<Text className={`text-lg font-semibold ${darkTheme ? 'text-white' : 'text-black'}`}>
														KSH {(Cart?.total_amount ?? 0).toFixed(2)}
													</Text>
												</View>
												{bottle_fee_total > 0 && (
													<View className="flex-row justify-between items-center pt-2">
														<View className="flex-col">
															<Text className={`text-base font-medium ${darkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
																New Bottle Fee
															</Text>
															<Text className={`text-xs italic ${darkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
																Required for first order
															</Text>
														</View>
														<Text className={`text-lg font-semibold ${darkTheme ? 'text-white' : 'text-black'}`}>
															KSH {bottle_fee_total.toFixed(2)}
														</Text>
													</View>
												)}
												{welcome_discount > 0 && (
													<View className="flex-row justify-between items-center pt-2">
														<View className="flex-col">
															<Text className={`text-base font-medium ${darkTheme ? 'text-green-400' : 'text-green-600'}`}>
																First Bottle Discount
															</Text>
															<Text className={`text-xs italic ${darkTheme ? 'text-green-400/80' : 'text-green-600/80'}`}>
																30% Welcome Offer Applied
															</Text>
														</View>
														<Text className={`text-lg font-semibold ${darkTheme ? 'text-green-400' : 'text-green-600'}`}>
															- KSH {welcome_discount.toFixed(2)}
														</Text>
													</View>
												)}
												<View className="flex-col pb-4 border-b ${darkTheme ? 'border-white/10' : 'border-gray-200'}">
													<View className={`flex-row justify-between items-center`}>
														<Text className={`text-base font-medium ${darkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
															Delivery Fee
														</Text>
														<Text className={`text-lg font-semibold ${darkTheme ? 'text-white' : 'text-black'}`}>
															KSH {deliveryFee.toFixed(2)}
														</Text>
													</View>
													{vendor_type === 'wholesale_b2b' && (
														<Text className={`text-xs italic mt-1 ${darkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
															* 0% commission on delivery. Fees are set directly by the wholesale vendor.
														</Text>
													)}
												</View>
												<View className={`flex-row justify-between items-center pb-4 border-b ${darkTheme ? 'border-white/10' : 'border-gray-200'}`}>
													<Text className={`text-base font-medium ${darkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
														Service Fee
													</Text>
													<Text className={`text-lg font-semibold ${darkTheme ? 'text-white' : 'text-black'}`}>
														KSH {serviceFee.toFixed(2)}
													</Text>
												</View>
												
												{/* --- Surcharges --- */}
												{payload_surcharge > 0 && (
													<View className="flex-row justify-between items-center pt-2">
														<View className="flex-row items-center gap-1">
															<Text className={`text-base font-medium ${darkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
																Heavy Payload Surcharge
															</Text>
															{/* Info Icon placeholder - could be added later */}
														</View>
														<Text className={`text-lg font-semibold ${darkTheme ? 'text-white' : 'text-black'}`}>
															KSH {payload_surcharge.toFixed(2)}
														</Text>
													</View>
												)}
												{staircase_surcharge > 0 && (
													<View className="flex-row justify-between items-center pt-2">
														<View className="flex-row items-center gap-1">
															<Text className={`text-base font-medium ${darkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
																Staircase Surcharge (Floor {floor_level})
															</Text>
															{/* Info Icon placeholder */}
														</View>
														<Text className={`text-lg font-semibold ${darkTheme ? 'text-white' : 'text-black'}`}>
															KSH {staircase_surcharge.toFixed(2)}
														</Text>
													</View>
												)}
												{wallet_discount > 0 && (
													<View 
														className="flex-row justify-between items-center pt-2 pb-2 border-b border-dashed"
														style={{ borderBottomColor: darkTheme ? BRAND.gray800 : BRAND.gray200 }}
													>
														<View className="flex-col">
															<Text className="text-base font-medium" style={{ color: BRAND.primary }}>
																Drop Cashback Applied
															</Text>
														</View>
														<Text className="text-lg font-semibold" style={{ color: BRAND.primary }}>
															- KSH {wallet_discount.toFixed(2)}
														</Text>
													</View>
												)}

												<View className="flex-row justify-between items-center pt-4">
													<Text className={`text-xl font-bold tracking-tight ${darkTheme ? 'text-white' : 'text-black'}`}>
														Total Amount
													</Text>
													<Text className={`text-2xl font-bold tracking-tight ${darkTheme ? 'text-accentbg' : 'text-primary'}`}>
														KSH {finalTotal.toFixed(2)}
													</Text>
												</View>
											</View>
										)
									}

									{/* Place Order Button */}
									{CartLoaded && Cart?.cart_item?.length > 0 && (
										<TouchableOpacity 
											className="w-full mt-2" 
											activeOpacity={0.7}
											onPress={() => setCheckoutVisible(true)}
										>
											<View className={`w-full py-4 rounded-full flex-row items-center justify-center bg-primary`}>
												<Text className={`text-xl font-bold tracking-tight text-white`}>
													Checkout • KSH {finalTotal.toFixed(2)}
												</Text>
											</View>
										</TouchableOpacity>
									)}
								</View>
							)}
						</ScrollView>
					</View>

				</Animated.View>
			</SafeAreaView>
			{/* Modals */}
			{/* <------------------------------CHECKOUT MODAL------------------------------> */}
			<Modal 
				visible={CheckoutVisible} 
				transparent={true}
				animationType="slide"
				onRequestClose={() => {
					setCheckoutVisible(false)
					setModalPage(1)
					initialPage()
				}}
			>
				<TouchableOpacity 
					className={`flex-1 w-full justify-end bg-black/40`}
					activeOpacity={1}
					onPress={() => {
						setCheckoutVisible(false)
						setModalPage(1)
						initialPage()
					}}
				>
					<TouchableOpacity 
						activeOpacity={1} 
						className={`min-w-full ${darkTheme?"bg-black":"bg-white"} rounded-t-2xl pb-4 border-t ${darkTheme ? 'border-white/10' : 'border-gray-200'}`}
						onPress={(e) => e.stopPropagation()}
					>
						<View className={`w-full items-center h-[60px] justify-center`}>
							<Text className={`text-2xl font-semibold ${darkTheme?"text-white":"text-black"}`}>Checkout</Text>
						</View>
						<View className=" py-7 items-center flex-row justify-evenly w-[90%] self-center">
							<Animated.View className={`w-full flex-row absolute self-center rounded-full gap-2 h-1  m-2`}>
								{/* progress bar */}
								<Animated.View className={`rounded-full flex-1 h-full bg-primary `}
									style={{
									}}
								/>
								<Animated.View className={`rounded-full flex-1 h-full ${modalPage >= 2 ? "bg-primary": darkTheme?"bg-gray-200/20":"bg-white"} `}
									style={{
									}}
								/>
								<Animated.View className={`rounded-full flex-1 h-full ${modalPage >= 3 ? "bg-primary": darkTheme?"bg-gray-200/20":"bg-white"} `}
									style={{
									}}
								/>
							</Animated.View>
						</View>
						{/* pager View  PAGES [ REVIEW ITEMS, DELIVERY ADDRESS, PAYMENT METHOD, PAYMENT]*/}
							<ScrollView>
								<View className={`w-full pb-[50px] flex-row overflow-scroll flex-nowrap`}>
											<Animated.View className="flex-row max-h-[300px]"
												style={[
													animatedTranslateX
												]}
											>
												<View
													className="gap-3"
													style={{
														minWidth: width,
													}}
												>
													<Text className={`font-semibold text-xl self-center ${darkTheme?"text-white":""}`}>
														Payment method
													</Text>
													<View className={`px-4 py-2 items-center`}>
														<Text className={`text-base ${darkTheme?"text-white":""}`}>
															Choose your preferred payment method
														</Text>
													</View>
													<View className="flex-row justify-center gap-4 px-4 mt-2">
														{/* M-PESA */}
														<TouchableOpacity
															activeOpacity={0.6}
															className="flex-1 h-[60px] justify-center items-center max-w-[160px]"
															onPress={()=> {
																setPaymentMethod("mpesa")
																nextPage()
																setModalPage(2)
															}}
														>
															<View className={`w-full h-full justify-center items-center rounded-2xl bg-green-700`}>
																<Image source={images.mpesa_logo} className="h-[40px] w-[90px]" resizeMode="contain" />
															</View>
														</TouchableOpacity>

														{/* Cash on Delivery */}
														<TouchableOpacity
															activeOpacity={0.6}
															className="flex-1 h-[60px] justify-center items-center max-w-[160px]"
															onPress={() => {
																setPaymentMethod("cash")
																nextPage()
																setModalPage(2)
															}}
														>
															<View className={`w-full h-full justify-center items-center rounded-2xl border ${darkTheme ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
																<Ionicons name="cash-outline" size={24} color={BRAND.primary} />
																<Text className={`font-bold mt-1 text-xs ${darkTheme ? "text-slate-300" : "text-slate-700"}`}>Cash on Delivery</Text>
															</View>
														</TouchableOpacity>
													</View>
													</View>

												<View
													className=" py-3"
													style={{
														minWidth: width,
													}}
												>
													{
														PaymentMethod == "mpesa" && (
															<View className={`w-full  items-center gap-4`}>
																<Image source={images.mpesa_logo} className="h-[40px] w-[100px]" resizeMode="contain"/>
																<Text className={`text-base font-semibold ${darkTheme?"text-white":""}`}>
																	Enter your Phone Number:
																</Text>

																<View className={`px-5 flex-row h-[50px] min-w-[250px] gap-2 items-center rounded-full ${darkTheme?"bg-gray-200/20":"bg-white"}`}>
																	<Ionicons name="call" size={20} color={BRAND.primary} />
																	<Text className={`text-base font-semibold ${darkTheme?"text-white":""}`}>+254</Text>
																	<TextInput
																		placeholder="712345678"
																		placeholderTextColor={darkTheme ? "#888" : "#A0AEC0"}
																		keyboardType='numeric'
																		maxLength={10}
																		className={`flex-1 h-full text-base ${darkTheme ? "text-white" : "text-black"}`}
																		onChangeText={(text) => {
																			// Strip non-digits, leading 0 or country code
																			let cleaned = text.replace(/[^0-9]/g, '');
																			if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
																			if (cleaned.startsWith('254')) cleaned = cleaned.substring(3);
																			setPhoneNumber(cleaned);
																		}}
																	/>
																</View>
																<View 
																	className="px-5 items-center mb-2"
																	style={{
																		maxWidth: width,
																		width
																	}}
																>
																	<Text className={`text-sm text-center ${darkTheme?"text-gray-300":"text-gray-600"}`}>
																		When you press continue, an M-PESA prompt will be sent to your phone to complete the transaction.
																	</Text>
																</View>
																<View className={` flex-row justify-center gap-3`}>
																	<TouchableOpacity
																		disabled={!PhoneNumber || PhoneNumber.length < 8 || PaymentLoading}
																		activeOpacity={0.6}
																		onPress={()=>{
																			prevPage()
																			setModalPage(1)
																		}}
																	>
																		<BackButtonMinimal />
																	</TouchableOpacity>
																	<TouchableOpacity
																		disabled={!PhoneNumber || PhoneNumber.length < 8 || PaymentLoading}
																		activeOpacity={0.6}
																		onPress={()=>{
																			Checkout()
																			
																		}}
																	>
																		<View className={`h-[40px] min-w-[200px] items-center justify-center px-6 rounded-full bg-green-500`}>
																			{PaymentLoading ? (
																				<View className={`w-9 h-9 items-center justify-center`}>
																					<ActivityIndicator size="small" color={darkTheme ? BRAND.bgDark : BRAND.white} />
																				</View>
																			) : (
																				<Text className={`font-bold text-xl ${darkTheme?"":"text-white"}`}>Continue</Text>
																			)}
																		</View>
																	</TouchableOpacity>
																</View>
															</View>
														)
													}
													{
														PaymentMethod == "cash" && (
															<View className={`w-full items-center gap-4 px-6`}>
																<View className={`w-16 h-16 rounded-full items-center justify-center mb-2 ${darkTheme ? "bg-slate-800" : "bg-green-50"}`}>
																	<Ionicons name="cash" size={32} color={BRAND.primary} />
																</View>
																<Text className={`text-xl font-bold text-center ${darkTheme ? "text-white" : "text-slate-900"}`}>
																	Pay with Cash
																</Text>
																<Text className={`text-center text-base mb-4 ${darkTheme ? "text-slate-400" : "text-slate-500"}`}>
																	You will pay <Text className="font-bold">KSH {finalTotal.toFixed(2)}</Text> in cash to the rider upon delivery.
																</Text>
																
																<View className={` flex-row justify-center gap-3 w-full`}>
																	<TouchableOpacity
																		disabled={PaymentLoading}
																		activeOpacity={0.6}
																		onPress={()=>{
																			prevPage()
																			setModalPage(1)
																		}}
																	>
																		<BackButtonMinimal />
																	</TouchableOpacity>
																	<TouchableOpacity
																		disabled={PaymentLoading}
																		activeOpacity={0.6}
																		onPress={()=>{
																			Checkout()
																		}}
																		className="flex-1"
																	>
																		<View className={`h-[50px] w-full items-center justify-center rounded-full bg-green-500`}>
																			{PaymentLoading ? (
																				<ActivityIndicator size="small" color={BRAND.white} />
																			) : (
																				<Text className={`font-bold text-lg text-white`}>Place Order</Text>
																			)}
																		</View>
																	</TouchableOpacity>
																</View>
															</View>
														)
													}
												</View>
												<View
													className=""
													style={{
														minWidth: width,
													}}
												>
													<View className={`w-full items-center gap-5 py-3`}>
														<Text className={`text-xl font-semibold ${darkTheme?"text-white":""}`}>Confirmation</Text>
														<Text className={`text-base text-center px-4 ${darkTheme?"text-gray-300":"text-gray-600"}`}>Please press Confirm once you have completed the M-PESA transaction on your phone.</Text>
														<TouchableOpacity
															disabled={CheckoutRequestID === null || PaymentLoading || ConfirmPaymentLoading}
															activeOpacity={0.6}
															onPress={()=>{
																// Checkout()
																// nextPage()
																confirmTransaction(true)
															}}
														>
															<View className={`h-[40px] min-w-[200px] items-center justify-center px-6 rounded-full bg-green-500`}>
																{PaymentLoading || ConfirmPaymentLoading ? (
																	<View className={`w-9 h-9 items-center justify-center`}>
																		<ActivityIndicator size="small" color={darkTheme ? BRAND.bgDark : BRAND.white} />
																	</View>
																) : (
																	<Text className={`font-bold text-xl ${darkTheme?"":"text-white"}`}>Confirm</Text>
																)}
															</View>
														</TouchableOpacity>
													</View>
												</View>
											</Animated.View>
								</View>
								<View className="w-full flex-row items-center justify-center">
									{/* buttons */}
									{/* <TouchableOpacity
										activeOpacity={0.6}
										onPress={()=> {
											nextPage()
										}}
									>
										<View className={`rounded-full px-6 py-2 bg-blue-500`}>
											<Text className={`font-bold text-xl ${darkTheme?"text-black":"text-white"}`}>Next</Text>
										</View>
									</TouchableOpacity> */}
								</View>
							</ScrollView>
					</TouchableOpacity>
				</TouchableOpacity>
			</Modal>

			{/* <------------------------------SUCCESS MODAL------------------------------> */}
			<Modal visible={SuccessModal} transparent animationType="fade">
				<View className="w-full flex-1 items-center justify-center bg-black/50">
					<View className={`min-w-[200px] min-h-[250px] ${darkTheme?"bg-black":"bg-white"} p-7 rounded-xl items-center gap-5`}>
						<View className="h-[160px] w-[160px] items-center justify-center bg-green-500 rounded-full shadow-xl ">
							<Ionicons name="checkmark-circle" size={24} color={BRAND.white} />
						</View>
						<Text className={`text-xl font-semibold ${darkTheme?"text-white":""}`}>Transaction was completed successfully.</Text>
						<View className={`gap-4 flex-row `}>
							<TouchableOpacity
								activeOpacity={0.6}
								onPress={()=>{
									router.push("/(screens)")
								}}
							>
								<Button style={`rounded-full ${darkTheme?"bg-gray-200/20":"bg-white"}`} label={"Continue Shopping "} textStyle={`font-semibold text-lg ${darkTheme?"text-white":"text-black"}`}/>
							</TouchableOpacity>
							<TouchableOpacity
								activeOpacity={0.6}
								onPress={()=>{
									router.push("/(screens)/Orders")
								}}
							>
								<Button style={"bg-primary rounded-full"} label={"See Order "} textStyle={`font-semibold text-lg text-white`}/>
							</TouchableOpacity>
							
						</View>
					</View>
				</View>
			</Modal>

			{/* <------------------------------SUCCESS MODAL------------------------------> */}
			<Modal visible={ErrorModal} transparent animationType="fade">
			<View className="w-full flex-1 items-center justify-center">
					<View className={`min-w-[200px] min-h-[250px] ${darkTheme?"bg-black":"bg-white"} p-7 rounded-xl items-center gap-5`}>
						<View className="h-[100px] w-[100px] items-center justify-center bg-red-500 rounded-full shadow-xl ">
							<Ionicons name="close" size={24} color={BRAND.white} />
						</View>
						<Text className={`text-xl font-semibold ${darkTheme?"text-white":""}`}>{ErrorMessage}</Text>
						<Text className={`text-xl font-semibold ${darkTheme?"text-white":""}`}></Text>
						<View className={`gap-4 flex-row `}>
							<TouchableOpacity
								activeOpacity={0.6}
								onPress={()=>{
									// router.push("/(screens)")
									setErrorModal(false)
								}}
							>
								<Button style={`rounded-full px-5 ${darkTheme?"bg-gray-200/20":"bg-white"}`} label={"Cancel"} textStyle={`font-semibold text-lg ${darkTheme?"text-white":"text-black"}`}/>
							</TouchableOpacity>
							<TouchableOpacity
								activeOpacity={0.6}
								onPress={()=>{
									setErrorModal(false);
									setCheckoutVisible(true);
									setModalPage(3);
								}}
							>
								<Button style={"bg-primary rounded-full px-5"} label={"Re-try"} textStyle={`font-semibold text-lg text-white`}/>
							</TouchableOpacity>
							
						</View>
					</View>
				</View>		
			</Modal>
		</>
	);
}

