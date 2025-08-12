import axios from 'axios';
import { showErrorToast } from "../utils/showToast";
import { Alert } from 'react-native';
 
// const BASE_URL = 'http://admin.taxitime.co.nz'; // Replace with your actual base URL
// export const BASE_URL = "https://taxitime.co.nz/api";
// export const BASE_URL = 'http://10.0.5.10:3000'; // Replace with your actual base URL
export const BASE_URL = 'http://192.168.18.5:3000'; // Replace with your actual base URL
// export const BASE_URL_SOCKET = '10.0.5.10:3000';
// export const BASE_URL_SOCKET = 'taxitime.co.nz/api';
export const BASE_URL_SOCKET = '192.168.18.5:3000';
const request = async (method, endpoint, data = null, headers = {}) => {
  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${endpoint}`,
      data,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });

    const result = response.data;

    // console.log("res", response);

    if (response.status < 200 || response.status >= 300) {
      showErrorToast('Error', result.message || 'Request failed');
    } else if (result.error) {
 

      console.error('API returned an error:', result);
      showErrorToast('Error', result.error || 'An error occurred');
    }

    return result;

  } catch (error) {
    const errorMessage = `
      Request Failed:
      Message: ${error.message}
      URL: ${error.config?.url || 'N/A'}
      Status: ${error.response?.status || 'N/A'}
      Response: ${JSON.stringify(error.response?.data || {}, null, 2)}
      Time: ${new Date().toLocaleString()}
          `;

    console.error('Caught Exception:', errorMessage, error.message);
    // Alert.alert('Exception', errorMessage.trim());
    // showErrorToast('Error', error.message || 'Something went wrong');
    throw error;
  }
};

export const api = {
  get: (endpoint, headers) => request('GET', endpoint, null, headers),
  post: (endpoint, data, headers) => request('POST', endpoint, data, headers),
  put: (endpoint, data, headers) => request('PUT', endpoint, data, headers),
  delete: (endpoint, data, headers) => request('DELETE', endpoint, data, headers),
};

export default api;
