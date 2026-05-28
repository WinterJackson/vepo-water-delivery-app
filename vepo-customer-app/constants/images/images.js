// import image
import { Asset } from "expo-asset";

import profile_placeholder from '../../assets/images/person-placeholder.png' 
import authBgLight from '../../assets/images/authbglight.jpg'
import mpesa_logo from '../../assets/images/mpesa_logo.png'
import card_payment from '../../assets/images/card_payment.png'
import google_logo from '../../assets/images/google.png'
import logo from '../../assets/images/vepo-logo.png'
import logo_white from '../../assets/images/vepo-white.jpg'
import ongoing_delivery from '../../assets/images/ongoing_delivery.png'
import logo_black from '../../assets/images/vepo_black.jpeg'
import empty_cart from '../../assets/images/empty-cart.png'


const images = {
    profile_placeholder,
    authBgLight,
    google_logo,
    logo_white,
    ongoing_delivery,
    logo_black,
    empty_cart,
    logo,
    mpesa_logo,
    card_payment
}


export async function preloadImages() {
    const imageArray = Object.values(images);
    const cacheImages = imageArray.map((image) => Asset.fromModule(image).downloadAsync());
    await Promise.all(cacheImages);
}

export default images 
