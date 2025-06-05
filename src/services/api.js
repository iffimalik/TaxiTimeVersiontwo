import axios from 'axios';
import { showErrorToast } from "../utils/showToast";
import { Alert } from 'react-native';

// const BASE_URL = 'http://admin.taxitime.co.nz'; // Replace with your actual base URL
const BASE_URL = "https://taxitime.co.nz/api";
// const BASE_URL = 'http://10.0.1.17:3001'; // Replace with your actual base URL
// const BASE_URL = 'http://192.168.18.8:3001'; // Replace with your actual base URL

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

    console.log("res", response);

    if (response.status < 200 || response.status >= 300) {
      showErrorToast('Error', result.message || 'Request failed');
    } else if (result.error) {
      const errorMessage = `
API Error:
Method: ${method}
Error: ${result.error}
URL: ${response.config?.url || 'N/A'}
Time: ${new Date().toLocaleString()}
      `;

      console.error('API returned an error:', result);
      // Alert.alert('API Error', errorMessage.trim());
      // showErrorToast('Error', result.error);
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

    console.error('Caught Exception:', error);
    // Alert.alert('Exception', errorMessage.trim());
    // showErrorToast('Error', error.message || 'Something went wrong');
    // throw error;
  }
};

export const api = {
  get: (endpoint, headers) => request('GET', endpoint, null, headers),
  post: (endpoint, data, headers) => request('POST', endpoint, data, headers),
  put: (endpoint, data, headers) => request('PUT', endpoint, data, headers),
  delete: (endpoint, data, headers) => request('DELETE', endpoint, data, headers),
};

export default api;
