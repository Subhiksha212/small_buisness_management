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
    config.headers.Authorization = `Bearer ${token}`;
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
      // Clear token on 401 if unauthorized
      if (localStorage.getItem('token')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
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

export const getExpenses = async () => {
  const response = await api.get('/expenses');
  return response.data;
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

export const simulateTestPayment = async (amount, paymentMethod) => {
  const response = await api.post('/payments/simulate-test-payment', { amount, paymentMethod });
  return response.data;
};

export default api;
