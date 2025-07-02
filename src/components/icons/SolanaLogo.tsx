import React from 'react'
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg'
import {nanoid} from 'nanoid/non-secure'

import {type Props, useCommonSVGProps} from '#/components/icons/common'

export const SolanaLogo = React.forwardRef<Svg, Props>(
  function SolanaLogoImpl(props, ref) {
    const {size, style, ...rest} = useCommonSVGProps(props)

    // Generate unique gradient ID to avoid conflicts during navigation
    const gradientId = React.useMemo(() => `solanaGradient_${nanoid()}`, [])

    return (
      <Svg
        {...rest}
        ref={ref}
        viewBox="0 0 560 400"
        width={size}
        height={size}
        style={[style]}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#00ffa3" />
            <Stop offset="100%" stopColor="#dc1fff" />
          </LinearGradient>
        </Defs>

        {/* Black circle background */}
        <Circle cx="280" cy="200" r="200" fill="#000000" />

        {/* Solana logo - exact copy from source SVG */}
        <G
          fillRule="nonzero"
          transform="matrix(.641643 0 0 .641643 152.409 100)">
          <Path
            d="m64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8h-317.4c-5.8 0-8.7-7-4.6-11.1z"
            fill={`url(#${gradientId})`}
          />
          <Path
            d="m64.6 3.8c2.5-2.4 5.8-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8h-317.4c-5.8 0-8.7-7-4.6-11.1z"
            fill={`url(#${gradientId})`}
          />
          <Path
            d="m333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8h-317.4c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1z"
            fill={`url(#${gradientId})`}
          />
        </G>
      </Svg>
    )
  },
)
