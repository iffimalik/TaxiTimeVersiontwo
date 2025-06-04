import React from 'react';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';

const CarIcon = ({ size = 40, color = '#2196F3' }) => (
   
     
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G fill={color}>
        <Path d="M5 16a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 16a2 2 0 1 0 -4 0 2 2 0 0 0 4 0z" />
        <Path d="M3.5,12.5 L20.5,12.5 C21.3284271,12.5 22,12.1715729 22,11.75 L22,8.25 C22,7.82842712 21.3284271,7.5 20.5,7.5 L3.5,7.5 C2.67157288,7.5 2,7.82842712 2,8.25 L2,11.75 C2,12.1715729 2.67157288,12.5 3.5,12.5 Z" />
        <Path d="M6,17 L18,17 C18.5522847,17 19,16.5522847 19,16 L19,14 C19,13.4477153 18.5522847,13 18,13 L6,13 C5.44771525,13 5,13.4477153 5,14 L5,16 C5,16.5522847 5.44771525,17 6,17 Z" />
      </G>
      <Rect x="3" y="7" width="18" height="6" fill="none" stroke={color} strokeWidth="1.5" />
      <Circle cx="5" cy="16" r="2" fill={color} />
      <Circle cx="19" cy="16" r="2" fill={color} />
    </Svg>
);

export default CarIcon;
