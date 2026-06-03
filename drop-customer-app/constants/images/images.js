// import image
import { Asset } from "expo-asset";

import profile_placeholder from '../../assets/images/person-placeholder.png' 
import authBgLight from '../../assets/images/authbglight.jpg'
import mpesa_logo from '../../assets/images/mpesa_logo.png'
import card_payment from '../../assets/images/card_payment.png'
import google_logo from '../../assets/images/google.png'
import logo_light from '../../assets/images/drop-logo-light.png'
import logo_dark from '../../assets/images/drop-logo-dark.png'
import ongoing_delivery from '../../assets/images/ongoing_delivery.png'
import empty_cart from '../../assets/images/empty-cart.png'


const images = {
    profile_placeholder,
    authBgLight,
    google_logo,
    logo_dark,
    ongoing_delivery,
    empty_cart,
    logo_light,
    mpesa_logo,
    card_payment
}


export async function preloadImages() {
    const imageArray = Object.values(images);
    const cacheImages = imageArray.map((image) => Asset.fromModule(image).downloadAsync());
    await Promise.all(cacheImages);
}

export default images 
