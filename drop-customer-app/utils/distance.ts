export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180)
}

function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} mins`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Robustly calculates an estimated delivery time string.
 * Base preparation time is 15 minutes + 5 minutes per kilometer.
 */
export function estimateDeliveryTime(vendorLat?: number, vendorLng?: number, userLat?: number, userLng?: number): string {
    if (!vendorLat || !vendorLng || !userLat || !userLng) {
        return "Est. Delivery available";
    }

    try {
        const distanceKm = calculateDistance(userLat, userLng, vendorLat, vendorLng);
        // Base prep time 15 mins + 5 mins per km
        const totalMins = Math.round(15 + (distanceKm * 5));
        
        // Return a range to manage expectations realistically
        const minMins = totalMins;
        const maxMins = totalMins + 15;

        if (maxMins < 60) {
            return `${minMins}-${maxMins} mins`;
        } else {
            return `${formatDuration(minMins)} - ${formatDuration(maxMins)}`;
        }
    } catch (error) {
        return "Est. Delivery available";
    }
}
