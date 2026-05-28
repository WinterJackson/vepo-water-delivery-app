import { UIThemeContext } from "@/context/ThemeContext";
import { useAddToCart } from "@/hooks/queries/useCart";
import { useCancelOrder } from "@/hooks/queries/useOrders";
import { useAuth } from "@clerk/clerk-expo";
import { format, parseISO } from 'date-fns';
import { useRouter } from "expo-router";
import React, { useContext, useLayoutEffect, useState, useMemo } from "react";
import { Image, Text, View } from "react-native";
import { Toast } from "@/lib/toast";
import { Popup } from "@/lib/popup";
import { PressableScale } from "@/components/ui/PressableScale";
import { Skeleton } from "@/components/ui/Skeleton";

type Props = {
  order: any;
};

// FIX-RERENDER-08: Extract LiveETA into its own React.memo component.
// The 1-second interval ONLY causes re-renders inside this tiny component,
// not the entire OrderCard or the parent list.
const LiveETA = React.memo(({ createdAt, status }: { createdAt: string, status: string }) => {
   const [timeLeft, setTimeLeft] = useState("");

   React.useEffect(() => {
      if (!createdAt) return;
      const targetTime = new Date(createdAt).getTime() + 30 * 60000; // 30 mins total SLA
      
      const updateTimer = () => {
         const now = new Date().getTime();
         const diff = targetTime - now;
         
         if (status === "in_transit" || status === "picked_up") {
            setTimeLeft("5-10 mins");
            return;
         }

         if (diff <= 0) {
            setTimeLeft("Almost there!");
            return;
         }
         const mins = Math.floor(diff / 60000);
         const secs = Math.floor((diff % 60000) / 1000);
         setTimeLeft(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      };

      updateTimer();
      // FIX-RERENDER-09: For statuses that show a static string ("5-10 mins"),
      // don't run the interval at all — it's wasteful.
      if (status === "in_transit" || status === "picked_up") return;
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
   }, [createdAt, status]);

   return (
       <View className="flex-row items-center bg-sky-500/10 px-3 py-1 rounded-full border border-sky-500/20 ml-2">
         <Text className="text-sky-600 dark:text-sky-400 font-bold mr-1 text-xs">⏳ ETA:</Text>
         <Text className="text-sky-600 dark:text-sky-400 font-bold text-xs">{timeLeft}</Text>
       </View>
   )
});

// FIX-RERENDER-10: Wrap entire OrderCard in React.memo.
// FlashList passes the same `order` object reference when data hasn't changed,
// so memo prevents re-renders from parent state changes (filter toggle, refreshing, etc.)
const OrderCard = React.memo(({ order }: Props) => {
  const router = useRouter();
  const { userId } = useAuth();
  const { mutate: addToCart } = useAddToCart();
  const { mutate: cancelOrderMutation, isPending: cancelLoading } = useCancelOrder();

  const {currentTheme} = useContext(UIThemeContext);
	const darkTheme = currentTheme === "dark"

  // <-------------HOOKS-------------->
  const [showItems, setShowItems] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(false);

  // FIX-RERENDER-11: Compute action as a memoized value instead of
  // storing in state + calling setAct() in useLayoutEffect.
  // This eliminates an unnecessary state update on mount.
  const action = useMemo(() => {
    if (order.order_status === "out for delivery") return 'Track Order';
    if ((order.order_status === "completed" || order.order_status === "delivered") && !order.is_rated) return 'Rate Delivery';
    if (order.order_status === "cancelled") return 'Re-Order';
    if (order.order_status === "pending" || order.order_status === "unassigned" || order.order_status === "accepted") return 'Cancel Order';
    return '';
  }, [order.order_status, order.is_rated]);

  const getStatusStyle = (status: string) => {
      const s = status.toLowerCase();
      if (s === 'delivered' || s === 'completed') return { badge: 'bg-green-500/20 border-green-500/30', text: 'text-green-500' };
      if (s === 'in_transit' || s === 'picked_up' || s === 'out for delivery') return { badge: 'bg-blue-500/20 border-blue-500/30', text: 'text-blue-500' };
      if (s === 'cancelled' || s === 'rejected') return { badge: 'bg-red-500/20 border-red-500/30', text: 'text-red-500' };
      if (s === 'mismatch_pending') return { badge: 'bg-amber-500/20 border-amber-500/30', text: 'text-amber-600 dark:text-amber-400' };
      return { badge: 'bg-yellow-500/20 border-yellow-500/30', text: 'text-yellow-600 dark:text-yellow-400' };
  };

  // Cancel order function
  const cancelOrder = (orderId: string) => {
    cancelOrderMutation(orderId, {
      onSuccess: () => {
        Toast.success("Success", "Order cancelled successfully");
      },
      onError: (error: any) => {
        Toast.error("Error", error.message || "Failed to cancel order");
      }
    });
  };

  const handleReorder = async (forceReplace = false) => {
    setReorderLoading(true);
    try {
      // Loop over order.order_item array and add each to cart consecutively
      const items = order?.order_item || [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await new Promise((resolve, reject) => {
          addToCart(
            {
              id: item.product_id,
              quantity: item.quantity,
              user_id: userId as string,
              force_replace: i === 0 ? forceReplace : false, // Only force on first item
            },
            { onSuccess: resolve as any, onError: reject }
          );
        });
      }
      Toast.success("Cart Updated", "Items accurately re-added to your cart!");
      router.push("/(screens)/Cart");
    } catch (e: any) {
      if (e?.type === "vendor_conflict") {
        Popup.show({
          title: "Replace Cart?",
          message: `Your cart has items from ${e.existing_vendor}. Re-ordering will replace your current cart.`,
          cancelText: "Cancel",
          confirmText: "Replace & Reorder",
          isDestructive: true,
          onConfirm: () => {
              Popup.hide();
              handleReorder(true);
          }
        });
      } else {
        console.error(e);
        Toast.error("Notice", "Some items may no longer be available in stock.");
      }
    } finally {
      setReorderLoading(false);
    }
  };

  // <-------------VARIABLES-------------->
  // FIX-RERENDER-12: Memoize date formatting — parseISO + format are not free
  const { dateStr, timeStr } = useMemo(() => {
    const parsedDate = parseISO(order.created_at);
    return {
      dateStr: format(parsedDate, 'dd MMM yyyy'),
      timeStr: format(parsedDate, 'HH:mm'),
    };
  }, [order.created_at]);
    
  return (
    <PressableScale
      activeOpacity={0.95}
      onPress={() => router.push({ pathname: "/(screens)/OrderDetail", params: { orderId: order.id } })}
      className="mb-3"
    >
      <View className={`flex-1 gap-2 ${darkTheme?"bg-gray-200/15":"bg-white"} rounded-xl p-4 transition-all duration-300`}>

      {/* DATE  AND AMOUNT */}
      <View className="flex-row justify-between items-center gap-[50px]">
        <View className={`flex-row gap-3`}>
          <Text className={`text-lg font-semibold ${darkTheme?"text-white":""}`}>Date: </Text>
          <Text className={`text-lg  ${darkTheme?"text-white":""}`}>{dateStr}</Text>
        </View>
        <View className={`flex-row gap-3`}>
          <Text className={`text-lg font-semibold ${darkTheme?"text-white":""}`}>Total Amt: Ksh </Text>
          <Text className={`text-lg  ${darkTheme?"text-white":""}`}>{order.total_amount}</Text>
        </View>
      </View>
       {/* ORDER STATUS AND CUSTOMER ACTIONS */}
       <View className={`flex-row justify-between gap-5 items-start mt-2`}>
         <View className={`flex-row gap-3 items-center`}>
           <Text className={`text-lg font-semibold ${darkTheme?"text-white":""}`}>Order Status: </Text>
           <View className={`px-3 py-1 rounded-full border border-gray-100 ${getStatusStyle(order.order_status).badge}`}>
             <Text className={`font-bold capitalize ${getStatusStyle(order.order_status).text}`}>{order.order_status.replace('_', ' ')}</Text>
           </View>
           {["accepted", "preparing", "ready", "picked_up", "in_transit"].includes(order.order_status) && (
               <LiveETA createdAt={order.created_at} status={order.order_status} />
           )}
         </View>
         {!showItems && (
           <View className="">
             <Text className={`${darkTheme?"text-white":"text-black"} text-lg font-semibold`}>{order?.order_item?.length || 0} items</Text>
           </View>
         )}
         {/* Vendor Location */}
         {!showItems && (
           <View className="">
             <Text className={`${darkTheme?"text-white":"text-black"} text-lg font-semibold`}>Vendor Location: </Text>
             <Text className={`text-lg  ${darkTheme?"text-white":""}`}>{order.vendor?.location_address || 'Location not available'}</Text>
           </View>
         )}
         {/* Customer actions */}
        
      </View>
      <View className="flex-row justify-between items-center gap-[50px]">
        <View className={`flex-row gap-3`}>
          <Text className={`text-lg font-semibold ${darkTheme?"text-white":""}`}>Payment Status: </Text>
          <Text className={`text-lg  ${darkTheme?"text-white":""}`}>{order.payment_status}</Text>
        </View>
{action != "" &&
           <PressableScale
             activeOpacity={0.7}
             disabled={action === "Cancel Order" && cancelLoading}
             onPress={() => {
               if(action === "Rate Delivery") router.push({ pathname: "/(screens)/RateOrder", params: { orderId: order.id, vendorId: order.vendor_id, riderId: order.deliverer_id } });
               else if(action === "Cancel Order") {
                 // Implement cancel order functionality
                 cancelOrder(order.id);
               }
             }}
           >
             <View className={`py-2 px-3 border rounded-lg ${darkTheme?"border-white":"border-black"}`}>
               {action === "Cancel Order" && cancelLoading ? (
                 <View className="flex-row items-center gap-2">
                    <Skeleton width={16} height={16} borderRadius={8} />
                   <Text>Cancelling...</Text>
                 </View>
               ) : (
                 <Text className={darkTheme?"text-white":"text-black"}>{action}</Text>
               )}
             </View>
           </PressableScale>
         }
      </View>
      {/* Re-Order */}
      {(order.order_status === "completed" || order.order_status === "delivered") && 
        <PressableScale 
          className=""
          activeOpacity={0.6}
          disabled={reorderLoading}
          onPress={() => handleReorder()}
        >
          <View className={`py-3 px-4 border rounded-xl items-center flex-row justify-center gap-2 mt-2 ${darkTheme?"border-white bg-white/10":"border-black bg-white"}`}>
            {reorderLoading ? (
               <Skeleton width={16} height={16} borderRadius={8} />
            ) : (
               <Text style={{ fontSize: 20 }}>↻</Text>
            )}
            <Text className={`font-bold text-lg ${darkTheme?"text-white":"text-black"}`}>
              {reorderLoading ? "Reordering..." : "Re-Order Items"}
            </Text>
          </View>
        </PressableScale>
      }
      {/* ORDER ITEMS */}
      {showItems && (
        <View>
              {order?.order_item?.map((item: any, index: any) => {
                return (
                  <PressableScale
                    key={index}
                    activeOpacity={0.6}
                  >
                    <View
                      className="p-2 flex-row gap-2 flex-1 rounded-xl "
                    >
                      {/* IMAGE  */}
                      <View className="h-[90px] w-[90px]">
                        <Image
                          source={{uri: item.product.image_url}}
                          className="w-full h-full rounded-lg"
                        />
                      </View>
                      {/* ORDER ITEM DETAILS: Product-name, quantity, price per unit, Subtotal per item*/}
                      <View className="flex-1 gap-2 justify-center ">
                        {/* product name */}
                        <Text className={darkTheme?"text-white":"text-black"}>{`${
                            item.product.name.length > 30
                              ? item.product.name.substring(0, 30).trim() + "..."
                              : item.product.name
                          }`}</Text>
                        <View className="flex-row gap-5 justify-between items-end">
                          <View className="">
                            <View className={`flex-row gap-3`}>
                              <Text className={`text-lg font-semibold ${darkTheme?"text-white":""}`}>Qty: </Text>
                              <Text className={`text-lg  ${darkTheme?"text-white":""}`}>{item.quantity}</Text>
                            </View>
                            <View className={`flex-row gap-3`}>
                              <Text className={`text-lg font-semibold ${darkTheme?"text-white":""}`}>Price: Ksh </Text>
                              <Text className={`text-lg  ${darkTheme?"text-white":""}`}>{item.price}</Text>
                            </View>
                          </View>
                          <View className="items-end">
                            <Text className={`text-lg font-semibold ${darkTheme?"text-white":""}`}>Subtotal</Text>
                            <Text className={`text-lg  ${darkTheme?"text-white":""}`}>Ksh {item.Subtotal}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </PressableScale>
                );
              })}
              <View className="gap-1">
              {/* Delivery Fee */}
              <View className="flex-row gap-2 items-end">
                <Text className={`font-semibold ${darkTheme?"text-white":"text-black"}`}>Delivery fee:</Text>
                <Text className={darkTheme?"text-white":"text-black"}>{`Ksh ${order.delivery_fee ?? 50}`}</Text>
              </View>
              {/* total amount */}
              <View className="flex-row gap-2 items-end">
                <Text className={`font-semibold ${darkTheme?"text-white":"text-black"}`}>Total Amt:</Text>
                <Text className={darkTheme?"text-white":"text-black"}>{`Ksh ${order.total_amount}`}</Text>
              </View>
            </View>
        </View>
      )}
      
      {!showItems ? (
        <>

          <PressableScale
            className=""
            activeOpacity={0.8}
            onPress={() => {
              setShowItems(true);
            }}
          >
            <View className="py-3 pr-3">
              <Text className={`text-lg font-semibold text-accentbg`}>See Order Details</Text>
            </View>
          </PressableScale>
        </>
      ) : (
        <>
          <PressableScale
            className=""
            activeOpacity={0.8}
            onPress={() => {
              setShowItems(false);
            }}
          >
            <View className="py-3 pr-3">
              <Text className={`text-lg font-semibold text-accentbg`}>See less...</Text>

            </View>
          </PressableScale>
        </>
      )}
      </View>
    </PressableScale>
  );
});

export default OrderCard;
