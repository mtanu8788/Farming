import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const detectDisease = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await api.post('/disease/detect', formData, {
    timeout: 35000,
  });
  return response.data;
};

export const getFertilizerRecommendation = async (data) => {
  const response = await api.post('/fertilizer/recommend', data);
  return response.data;
};

export const getWeatherForecast = async (city = 'Pune') => {
  const response = await api.get('/weather/forecast', { params: { city } });
  return response.data;
};

export const getCropRecommendation = async (data) => {
  const response = await api.post('/crop/recommend', data);
  return response.data;
};

export const askFarmerAssistant = async (message) => {
  const response = await api.post('/chat/ask', { message });
  return response.data;
};

export default api;
