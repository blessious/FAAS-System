import axios, { AxiosInstance, AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : 'http://localhost:3000/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error) => {
    console.error('API Error:', error);

    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error.response?.data || { error: 'Network error' });
  }
);

// Health check
export const healthCheck = (): Promise<any> => api.get('/health');


interface ChangePasswordData {
  currentPassword: string;  // or current_password based on what you choose
  newPassword: string;      // or new_password based on what you choose
}


interface User {
  id: number;
  username: string;
  role: string;
  full_name: string;
  profile_picture?: string;
  created_at: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
  message: string;
}


// Authentication
export const authAPI = {
  login: (credentials: LoginCredentials): Promise<LoginResponse> =>
    api.post('/auth/login', credentials),

  logout: (): Promise<{ success: boolean; message: string }> =>
    api.post('/auth/logout'),

  getProfile: (): Promise<User> =>
    api.get('/auth/profile'),

  updateProfile: (data: any): Promise<any> =>
    api.put('/auth/profile', data),

  changePassword: (data: ChangePasswordData): Promise<any> =>
    api.put('/auth/password', data),

  updateProfilePicture: (formData: FormData): Promise<any> =>
    api.post('/auth/profile-picture', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
};

// FAAS Records API
export const faasAPI = {
  getAllFAAS: (): Promise<any[]> =>
    api.get('/faas'),

  getFAASById: (id: string | number): Promise<any> =>
    api.get(`/faas/${id}`),

  createFAAS: (data: any): Promise<any> =>
    api.post('/faas', data),

  updateFAAS: (id: string | number, data: any): Promise<any> =>
    api.put(`/faas/${id}`, data),

  submitForApproval: (id: string | number): Promise<any> =>
    api.post(`/faas/${id}/submit`),

  getDrafts: (): Promise<any[]> =>
    api.get('/faas/drafts'),

  saveDraft: (data: any): Promise<any> =>
    api.post('/faas/drafts', data),

  createRecord: (data: any): Promise<any> =>
    api.post('/faas', data),

  updateRecord: (id: string, data: any): Promise<any> =>
    api.put(`/faas/${id}`, data),

  getRecord: (id: string): Promise<any> =>
    api.get(`/faas/${id}`),

  getMyRecords: (status?: string): Promise<any> => {
    const url = status ? `/faas/user/my-records?status=${status}` : '/faas/user/my-records';
    return api.get(url);
  },

  createDraft: (data: any): Promise<any> =>
    api.post('/faas/draft', data),

  saveAsDraft: (id: string, data: any): Promise<any> =>
    api.put(`/faas/draft/${id}`, data),

  deleteDraft: (id: string): Promise<any> =>
    api.delete(`/faas/draft/${id}`),

  getRecordHistory: (id: string | number): Promise<any> =>
    api.get(`/faas/${id}/history`),

  deleteHistoryEntry: (logId: number | string): Promise<any> =>
    api.delete(`/faas/history/${logId}`),

  clearRecordHistory: (id: string | number): Promise<any> =>
    api.delete(`/faas/${id}/history`)
};

// Approvals API
export const approvalAPI = {
  getPendingApprovals: (): Promise<any[]> =>
    api.get('/approvals/pending'),

  getApprovalStats: (): Promise<any> =>
    api.get('/approvals/stats'),

  approveRecord: (id: string | number, data: { comment: string }): Promise<any> =>
    api.post(`/approvals/${id}/approve`, data),

  rejectRecord: (id: string | number, data: { comment: string }): Promise<any> =>
    api.post(`/approvals/${id}/reject`, data),

  cancelAction: (id: string | number): Promise<any> =>
    api.post(`/approvals/${id}/cancel`),

  getApprovalHistory: (): Promise<any[]> =>
    api.get('/approvals/history'),

  getRejectedRecords: (): Promise<any[]> =>
    api.get('/approvals/rejected'),
};



// Print/Export API
export const printAPI = {
  generateFAASExcel: (recordId: string | number): Promise<any> =>
    api.post('/print/generate-faas', { recordId }),

  getGeneratedFiles: (recordId: string | number): Promise<any> =>
    api.get(`/print/files/${recordId}`),

  downloadFile: (filename: string): Promise<any> =>
    api.get(`/print/download/${filename}`, { responseType: 'blob' }),

  getApprovedRecords: (): Promise<any[]> =>
    api.get('/print/approved'),
};

export const dashboardAPI = {
  getStats: (): Promise<any> =>
    api.get('/dashboard/stats'),

  // Update this to handle the new paginated response
  getRecentRecords: (params?: { page?: number; limit?: number }): Promise<any> =>
    api.get('/dashboard/recent', { params }),

  getActivityLog: (): Promise<any[]> =>
    api.get('/dashboard/activity'),
};

// Users API
export const usersAPI = {
  getAllUsers: (): Promise<any[]> =>
    api.get('/users'),

  getUserById: (id: string | number): Promise<any> =>
    api.get(`/users/${id}`),

  createUser: (data: any): Promise<any> =>
    api.post('/users', data),

  updateUser: (id: string | number, data: any): Promise<any> =>
    api.put(`/users/${id}`, data),

  deleteUser: (id: string | number): Promise<any> =>
    api.delete(`/users/${id}`),

  getUserProfile: (): Promise<any> =>
    api.get('/users/profile'),
};

// Helper functions
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('token');
};

export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};


export const logout = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

export default api;