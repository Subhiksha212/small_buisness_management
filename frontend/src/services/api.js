import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach Authorization JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const responseMsg = (error.response.data?.message || '').toLowerCase();
      const isAuthMiddlewareError =
        responseMsg.includes('no token provided') ||
        responseMsg.includes('token failed') ||
        responseMsg.includes('user not found');

      // Clear token on genuine user session expiration
      if (isAuthMiddlewareError) {
        if (localStorage.getItem('token')) {
          localStorage.removeItem('token');
        }
        if (window.location.pathname !== '/settings' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth Endpoints
export const loginApi = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response.data;
};

export const registerApi = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

export const getMeApi = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const updateOnboardingApi = async (setupData) => {
  const response = await api.post('/auth/onboarding', setupData);
  return response.data;
};

// Existing Endpoints (Data strictly scoped on server)
export const getDashboardData = async (period = 'all', startDate = '', endDate = '') => {
  const response = await api.get('/dashboard', {
    params: { period, startDate, endDate },
  });
  return response.data;
};

export const getSales = async () => {
  const response = await api.get('/sales');
  return response.data;
};

export const createSale = async (saleData) => {
  const response = await api.post('/sales', saleData);
  return response.data;
};

export const deleteSale = async (id) => {
  const response = await api.delete(`/sales/${id}`);
  return response.data;
};

export const verifySale = async (id) => {
  const response = await api.patch(`/sales/${id}/verify`);
  return response.data;
};

export const refundSale = async (id) => {
  const response = await api.patch(`/sales/${id}/refund`);
  return response.data;
};

// Insights & Forecasting
export const getDashboardInsights = async () => {
  const response = await api.get('/dashboard/insights');
  return response.data;
};

// Inventory & Products Endpoints
export const getProducts = async (params = {}) => {
  const response = await api.get('/products', { params });
  return response.data;
};

export const createProduct = async (productData) => {
  const response = await api.post('/products', productData);
  return response.data;
};

export const updateProduct = async (id, productData) => {
  const response = await api.put(`/products/${id}`, productData);
  return response.data;
};

export const deleteProduct = async (id) => {
  const response = await api.delete(`/products/${id}`);
  return response.data;
};

export const adjustStock = async (id, data) => {
  const response = await api.post(`/products/${id}/adjust-stock`, data);
  return response.data;
};

export const getInventoryMovements = async (params = {}) => {
  const response = await api.get('/products/movements', { params });
  return response.data;
};

export const getLowStockProducts = async () => {
  const response = await api.get('/products/low-stock');
  return response.data;
};

export const getInventoryReports = async () => {
  const response = await api.get('/products/reports');
  return response.data;
};

export const lookupProduct = async (code) => {
  const response = await api.get('/products/lookup', { params: { code } });
  return response.data;
};

export const seedSampleProducts = async () => {
  const response = await api.post('/products/seed');
  return response.data;
};


export const checkReferenceUtr = async (utr) => {
  const response = await api.get('/payments/check-reference', { params: { utr } });
  return response.data;
};

export const getExpenses = async () => {
  const response = await api.get('/expenses');
  return response.data;
};

export const getTransactions = async () => {
  const [sales, expenses] = await Promise.all([getSales(), getExpenses()]);
  return [
    ...(sales || []).map((s) => ({ ...s, type: 'Sale' })),
    ...(expenses || []).map((e) => ({ ...e, type: 'Expense' })),
  ];
};

export const createExpense = async (expenseData) => {
  const response = await api.post('/expenses', expenseData);
  return response.data;
};

export const deleteExpense = async (id) => {
  const response = await api.delete(`/expenses/${id}`);
  return response.data;
};

export const getPaymentStatus = async () => {
  const response = await api.get('/payments/status');
  return response.data;
};

export const getAutomaticPayments = async () => {
  const response = await api.get('/payments/automatic');
  return response.data;
};

export const saveMerchantConfig = async (config) => {
  const response = await api.post('/payments/configure-merchant', config);
  return response.data;
};

export const simulateTestPayment = async (options) => {
  const payload = typeof options === 'object' ? options : { amount: options, paymentMethod: 'UPI' };
  const response = await api.post('/payments/simulate-test-payment', payload);
  return response.data;
};

export const recordUpiPayment = async (upiData) => {
  const response = await api.post('/payments/record-upi', upiData);
  return response.data;
};

// Real-time Gateway & Live Payment Endpoints
export const createRazorpayOrder = async (orderData) => {
  const response = await api.post('/payments/create-order', orderData);
  return response.data;
};

export const verifyRazorpayOrder = async (paymentData) => {
  const response = await api.post('/payments/verify-order', paymentData);
  return response.data;
};

export const syncGatewayPayments = async () => {
  const response = await api.get('/payments/sync-gateway');
  return response.data;
};

export const checkLivePayment = async (params = {}) => {
  const response = await api.get('/payments/live-check', { params });
  return response.data;
};

// Setu Account Aggregator Endpoints
export const getSetuConfig = async () => {
  const response = await api.get('/setu/config');
  return response.data;
};

export const createSetuConsent = async (payload = {}) => {
  const response = await api.post('/setu/consents', payload);
  return response.data;
};

export const verifySetuCallback = async (callbackData) => {
  const response = await api.post('/setu/verify-callback', callbackData);
  return response.data;
};

export const getSetuConsentStatus = async (consentId) => {
  const response = await api.get(`/setu/consents/${encodeURIComponent(consentId)}/status`);
  return response.data;
};

export const createSetuSession = async (payload = {}) => {
  const response = await api.post('/setu/sessions', payload);
  return response.data;
};

export const getSetuSession = async (sessionId) => {
  const response = await api.get(`/setu/sessions/${encodeURIComponent(sessionId)}`);
  return response.data;
};

export const fetchAndImportSetuData = async (payload = {}) => {
  const response = await api.post('/setu/fetch-data', payload);
  return response.data;
};

export const getSetuTransactions = async (params = {}) => {
  const response = await api.get('/setu/transactions', { params });
  return response.data;
};

export const classifySetuTransaction = async (id, payload = {}) => {
  const response = await api.patch(`/setu/transactions/${id}/classify`, payload);
  return response.data;
};

export default api;

