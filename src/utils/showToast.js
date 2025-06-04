// utils/showToast.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Toast, { BaseToast } from 'react-native-toast-message';

export const showSuccessToast = (title, message) => {
  Toast.show({
    type: 'success',
    text1: title,
    text2: message,
    position: 'top',
    topOffset: 50,
    visibilityTime: 3000,
  });
};

export const showErrorToast = (title, message) => {
  Toast.show({
    type: 'error',
    text1: title,
    text2: message,
    position: 'top',
    topOffset: 50,
    visibilityTime: 4000,
  });
};

export const showInfoToast = (title, message) => {
  Toast.show({
    type: 'info',
    text1: title,
    text2: message,
    position: 'top',
    topOffset: 50,
    visibilityTime: 3000,
  });
};

// ✅ Custom confirmation toast
export const showConfirmationToast = ({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}) => {
  Toast.show({
    type: 'custom_confirm',
    position: 'top',
    topOffset: 350,
    props: {
      title,
      message,
      onConfirm,
      onCancel,
      confirmText,
      cancelText,
    },
    autoHide: false,
  });
};

// Custom confirm toast component (must be registered)
export const toastConfig = {
 custom_confirm: ({ props }) => (
  <View
    style={{
      backgroundColor: '#fff',
      borderLeftColor: '#007bff',
      borderLeftWidth: 4,
      paddingVertical: 16,
      paddingHorizontal: 20,
      marginHorizontal: 12,
      marginTop: 10,
      borderRadius: 10,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 5,
    }}
  >
    <Text
      style={{
        fontWeight: '600',
        fontSize: 17,
        marginBottom: 6,
        color: '#222',
      }}
    >
      {props.title}
    </Text>

    <Text
      style={{
        fontSize: 15,
        color: '#444',
        marginBottom: 16,
        lineHeight: 21,
      }}
    >
      {props.message}
    </Text>

    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
      <TouchableOpacity
        onPress={() => {
          Toast.hide();
          props.onCancel?.();
        }}
        style={{
          marginRight: 10,
          paddingVertical: 8,
          paddingHorizontal: 16,
          backgroundColor: '#f1f1f1',
          borderRadius: 6,
        }}
      >
        <Text style={{ color: '#444', fontSize: 15 }}>{props.cancelText}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          Toast.hide();
          props.onConfirm?.();
        }}
        style={{
          backgroundColor: '#28a745',
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 6,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 15 }}>{props.confirmText}</Text>
      </TouchableOpacity>
    </View>
  </View>
),

};
