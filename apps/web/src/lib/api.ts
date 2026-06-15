import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('escrowx_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('escrowx_token');
      window.location.href = '/connect';
    }
    return Promise.reject(err.response?.data || err);
  },
);

// Auth
export const authApi = {
  getChallenge: (walletAddress: string) =>
    api.post('/auth/challenge', { walletAddress }) as Promise<{ challenge: string; xdr: string }>,
  verify: (walletAddress: string, challenge: string, signedXdr: string) =>
    api.post('/auth/verify', { walletAddress, challenge, signature: signedXdr }) as Promise<{
      access_token: string;
      user: any;
    }>,
};

// Users
export const usersApi = {
  getMe: () => api.get('/users/me'),
  updateMe: (data: any) => api.patch('/users/me', data),
  getProfile: (id: string) => api.get(`/users/${id}`),
  getLeaderboard: () => api.get('/users/leaderboard'),
};

// Projects
export const projectsApi = {
  submitSignedTx: (signedXdr: string) =>
    api.post('/projects/submit-signed-tx', { signedXdr }) as Promise<{ txHash: string }>,
  create: (data: any) => api.post('/projects', data),
  confirmCreation: (id: string, txHash: string) =>
    api.post(`/projects/${id}/confirm-creation`, { txHash }),
  buildFundTx: (id: string) => api.post(`/projects/${id}/fund`),
  confirmFunding: (id: string, txHash: string) =>
    api.post(`/projects/${id}/confirm-funding`, { txHash }),
  buildAcceptTx: (id: string) => api.post(`/projects/${id}/accept`),
  confirmAcceptance: (id: string, txHash: string) =>
    api.post(`/projects/${id}/confirm-acceptance`, { txHash }),
  list: (role: string, status?: string) =>
    api.get('/projects', { params: { role, status } }),
  browse: (page = 1, limit = 20) =>
    api.get('/projects/browse', { params: { page, limit } }),
  getOne: (id: string) => api.get(`/projects/${id}`),
  getPreview: (id: string) => api.get(`/projects/${id}/preview`),
  delete: (id: string) => api.delete(`/projects/${id}`),
  join: (id: string) => api.post(`/projects/${id}/join`),
  buildContractTx: (id: string) => api.post(`/projects/${id}/build-contract-tx`) as Promise<{ txXdr: string }>,
};

// Milestones
export const milestonesApi = {
  buildSubmitTx: (id: string) => api.post(`/milestones/${id}/submit`),
  confirmSubmit: (id: string, txHash: string, proofHash: string) =>
    api.post(`/milestones/${id}/confirm-submit`, { txHash, proofHash }),
  buildApproveTx: (id: string) => api.post(`/milestones/${id}/approve`),
  confirmApprove: (id: string, txHash: string) =>
    api.post(`/milestones/${id}/confirm-approve`, { txHash }),
  reject: (id: string, feedback: string) =>
    api.post(`/milestones/${id}/reject`, { feedback }),
};

// Submissions
export const submissionsApi = {
  // Do NOT set Content-Type manually — axios must include the multipart boundary automatically
  create: (milestoneId: string, formData: FormData) =>
    api.post(`/milestones/${milestoneId}/submissions`, formData),
  getOne: (milestoneId: string) => api.get(`/milestones/${milestoneId}/submissions`),
};

// Disputes
export const disputesApi = {
  buildRaiseTx: (projectId: string, data: any) =>
    api.post(`/projects/${projectId}/disputes/build-raise`, data),
  confirmRaise: (projectId: string, formData: FormData) =>
    api.post(`/projects/${projectId}/disputes/confirm-raise`, formData),
  getDispute: (projectId: string) => api.get(`/projects/${projectId}/disputes`),
  buildResolveTx: (projectId: string, data: any) =>
    api.post(`/projects/${projectId}/disputes/build-resolve`, data),
  confirmResolve: (projectId: string, data: any) =>
    api.post(`/projects/${projectId}/disputes/confirm-resolve`, data),
  getMyDisputes: () => api.get('/projects/disputes/my-disputes'),
};

// Messages
export const messagesApi = {
  send: (projectId: string, content: string) =>
    api.post(`/projects/${projectId}/messages`, { content }),
  list: (projectId: string, cursor?: string) =>
    api.get(`/projects/${projectId}/messages`, { params: { cursor } }),
};

// Reviews
export const reviewsApi = {
  create: (projectId: string, data: { rating: number; reviewText?: string }) =>
    api.post(`/reviews/projects/${projectId}`, data),
  getByProject: (projectId: string) => api.get(`/reviews/projects/${projectId}`),
  getByUser: (userId: string) => api.get(`/reviews/users/${userId}`),
};

// Admin
export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getProjects: (page = 1) => api.get('/admin/projects', { params: { page } }),
  getDisputes: () => api.get('/admin/disputes'),
  getUsers: (page = 1) => api.get('/admin/users', { params: { page } }),
  setArbitrator: (userId: string) => api.post(`/admin/users/${userId}/set-arbitrator`),
};

export default api;
