import React from 'react'
import Svg, {Circle, Path} from 'react-native-svg'

import {type Props, useCommonSVGProps} from '#/components/icons/common'

export const EthereumLogo = React.forwardRef<Svg, Props>(
  function EthereumLogoImpl(props, ref) {
    const {size, style, ...rest} = useCommonSVGProps(props)

    return (
      <Svg
        {...rest}
        ref={ref}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        style={[style]}>
        {/* Black circle background */}
        <Circle cx="12" cy="12" r="12" fill="#000000" />

        {/* Ethereum logo paths */}
        <Path
          d="M12 3L12.1 8.5L12 8.5L11.9 8.5L12 3Z"
          fill="#627EEA"
          opacity={0.6}
        />
        <Path d="M12 3L6.5 12.5L12 15.5L17.5 12.5L12 3Z" fill="#627EEA" />
        <Path
          d="M6.5 13.5L12 16.5L17.5 13.5L12 21L6.5 13.5Z"
          fill="#627EEA"
          opacity={0.8}
        />
        <Path
          d="M12 15.5L6.5 12.5L12 8.5L17.5 12.5L12 15.5Z"
          fill="#627EEA"
          opacity={0.4}
        />
      </Svg>
    )
  },
)
