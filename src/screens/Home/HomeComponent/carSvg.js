import React from 'react';
import Svg, { Path } from 'react-native-svg';

const CarIcon = ({ size = 40, color = '#FF0000' }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
  >
    <Path
      d="M4 32 L10 16 L54 16 L60 32 L60 48 L4 48 Z"
      fill={color}
      stroke="black"
      strokeWidth={2}
    />
    <Path
      d="M14 48 L14 56 L20 56 L20 48 Z"
      fill="black"
    />
    <Path
      d="M44 48 L44 56 L50 56 L50 48 Z"
      fill="black"
    />
  </Svg>
);

export default CarIcon;
