import axios from 'axios';
import { api, API_BASE_URL, buildApiUrl } from '../src/services/api';

jest.mock('axios');

describe('api service', () => {
  test('builds correct URL and returns data on success', async () => {
    axios.mockResolvedValueOnce({ status: 200, data: { ok: 1, value: 42 } });
    const res = await api.post('/path', { a: 1 }, { 'X-Test': 'T' });
    expect(axios).toHaveBeenCalledWith({
      method: 'POST',
      url: buildApiUrl('/path'),
      data: { a: 1 },
      headers: expect.objectContaining({ 'Content-Type': 'application/json', 'X-Test': 'T' }),
    });
    expect(res).toEqual({ ok: 1, value: 42 });
  });

  test('buildApiUrl joins paths with API_BASE_URL', () => {
    expect(buildApiUrl('/example')).toBe('http://10.0.2.2:3000/api/example');
    expect(buildApiUrl('example')).toBe('http://10.0.2.2:3000/api/example');
  });

  test('returns undefined on error (current behavior)', async () => {
    axios.mockRejectedValueOnce(new Error('Network down'));
    const res = await api.get('/fails');
    expect(res).toBeUndefined();
  });
});

