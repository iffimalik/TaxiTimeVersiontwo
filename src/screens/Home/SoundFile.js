// import { useEffect, useRef } from 'react';
// import Sound from 'react-native-sound';

// // Set category for playback (required for iOS, safe for Android)
// Sound.setCategory('Playback');

// export default function useNotificationSound() {
//   const soundRef = useRef(null);
//   const isPlayingRef = useRef(false);

//   useEffect(() => {
//     console.log('🔊 Loading sound...');

//     const sound = new Sound(require('../../screens/assets/notification.mp3'), (error) => {
//       if (error) {
//         console.log('❌ Failed to load sound:', error);
//         return;
//       }
//       console.log('✅ Sound loaded successfully');
//       soundRef.current = sound;
//     });

//     return () => {
//       if (soundRef.current) {
//         soundRef.current.release();
//         console.log('🧹 Sound released');
//       }
//     };
//   }, []);

//   const playSound = () => {
//     if (isPlayingRef.current || !soundRef.current) return;

//     isPlayingRef.current = true;

//     soundRef.current.play((success) => {
//       isPlayingRef.current = false;

//       if (success) {
//         console.log('✅ Sound played');
//       } else {
//         console.log('❌ Playback failed');
//       }
//     });
//   };

//   return { playSound };
// }
