import { Audio } from 'react-native-audio';
import { Platform } from 'react-native';

const soundFilePath = Platform.OS === 'android' ? 'file:///android_asset/whatsapp.mp3' : 'whatsapp.mp3';
let audioPlayer;

const setupAudio = () => {
  Audio.prepare(
    {
      url: soundFilePath,
      autoPlay: false,
      volume: 1.0,
    },
    (error) => {
      if (error) {
        // console.log('Error preparing audio player:', error);
      } else {
        // console.log('Audio player prepared successfully');
      }
    }
  );
};

const playNewMessageSound = () => {
  if (audioPlayer) {
    Audio.play();
  }
};

// Call setupAudio in your component's useEffect
// Call playNewMessageSound when a new unread message is detected

// Example usage in your useEffect for new messages:
// if (message && message.receiverId === userId && message.read == false) {
//   showInfoToast('New Message', message.text || 'Image');
//   playNewMessageSound();
// }

// You might need to handle cleanup if react-native-audio requires it.

export { setupAudio, playNewMessageSound };