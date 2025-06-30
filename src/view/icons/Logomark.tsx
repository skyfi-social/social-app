import Svg, {Path, type PathProps, type SvgProps} from 'react-native-svg'

const ratio = 54 / 61

export function Logomark({...rest}: {fill?: PathProps['fill']} & SvgProps) {
  // @ts-ignore it's fiiiiine
  const size = parseInt(rest.width || 32)

  return (
    <Svg
      viewBox="0 0 500 305"
      {...rest}
      width={size}
      height={Number(size) * ratio}>
      <Path
        fill="#46cc92"
        d="M500,167.6c0,65.18-61.69,118.07-137.92,118.07-18.56,0-36.38-3.13-52.5-8.91-18.94,17.1-45.75,27.77-75.47,27.77-23.81,0-45.66-6.82-63.19-18.3-12.38,3.29-25.6,5.06-39.19,5.06C58.97,291.29,0,240.8,0,178.51c0-59.08,53.07-107.56,120.66-112.37C132.57,28.09,173.17,0,221.36,0c43.78,0,81.19,23.04,96.75,55.71,13.78-4.01,28.6-6.18,43.97-6.18,76.22,0,137.92,52.9,137.92,118.07Z"
      />
    </Svg>
  )
}
