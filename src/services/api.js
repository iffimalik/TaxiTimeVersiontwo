import { showErrorToast } from "../utils/showToast";

// const BASE_URL = 'http://admin.taxitime.co.nz'; // Replace with your actual base URL
const BASE_URL = 'http://10.0.1.17:3001'; // Replace with your actual base URL
// const BASE_URL = 'http://192.168.18.8:3001'; // Replace with your actual base URL

const request = async (method, endpoint, data = null, headers = {}) => {
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, config);
    const result = await res.json();
    // console.log(`API Request: ${method} ${BASE_URL}${endpoint}`, {
    //   method,
    //   endpoint,
    //   data,
    //   headers,
    //   status: res.status,
    //   response: result,
    // });
    
    if (!res.ok) {
      // throw new Error(result.message || 'Request failed');
      showErrorToast('Error', result.message || 'Request failed');
    } else if (result.error) {
      // throw new Error(result.error);
      showErrorToast('Error', result.error);
    } 

    return result;
  } catch (error) {
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
