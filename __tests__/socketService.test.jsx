const React = require('react');
const { render, act } = require('@testing-library/react-native');
const AsyncStorage = require('@react-native-async-storage/async-storage');
const { WebSocketProvider } = require('../src/context/WebSocketContext');
const { buildWsUrlWithToken } = require('../src/services/api');

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn() }));

// Silence toast calls during tests
jest.mock('../src/utils/showToast', () => ({ showErrorToast: jest.fn(), showInfoToast: jest.fn() }));

// Mock contexts used by the hook
jest.mock('../src/context/TarrifContext', () => ({ TarrifContext: require('react').createContext({ selectedTarrif: null, setSelectedTarrif: jest.fn(), availableTariffs: [] }) }));
jest.mock('../src/context/ShiftContext', () => ({ ShiftContext: require('react').createContext({ driver: {} }) }));

describe('useDriverWebSocket URL construction', () => {
  let OriginalWebSocket;
  const sent = [];
  const created = [];

  beforeAll(() => {
    OriginalWebSocket = global.WebSocket;
    global.WebSocket = class WS {
      constructor(url) {
        created.push(url);
        // Immediately simulate open
        setTimeout(() => this.onopen && this.onopen(), 0);
      }
      send(data) { sent.push(data); }
      close() {}
    };
  });

  afterAll(() => {
    global.WebSocket = OriginalWebSocket;
  });

  it('creates ws URL with token and sends authenticate/subscribe', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('t0k3n');

    await act(async () => {
      render(
        <WebSocketProvider>
          <></>
        </WebSocketProvider>
      );
    });

    // last created socket url
    const url = created.pop();
    expect(url).toBe(buildWsUrlWithToken('t0k3n'));
    // Verify initial messages
    expect(sent.some(s => s.includes('authenticate'))).toBe(true);
    expect(sent.some(s => s.includes('subscribe'))).toBe(true);
  });
});
