import { View, Text, Dimensions } from 'react-native'
import React from 'react'


type Props = {
    percentage: number;
    width: number;
}

const PercentageBar = ({percentage, width}: Props) => {
    const fraction = percentage / 100 || 0;
  return (
    <View className='h-2  bg-gray-200 rounded-full '
        style={{
            width: width
        }}
    >
        {/* <View className={`h-full bg-accentbg rounded-full w-[60%]`}/> */}
        <View 
            className={`h-full bg-accentbg rounded-full `}
            style={{
                width : width * fraction
            }}
        />
    </View>
  )
}

export default PercentageBar