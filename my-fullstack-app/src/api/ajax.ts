import axios from 'axios';

const apiClient = axios.create({
    baseURL: process.env.API_BASE_URL,
    timeout: 1000,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const fetchData = async (endpoint: string, params?: any) => {
    try {
        const response = await apiClient.get(endpoint, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
};

export const postData = async (endpoint: string, data: any) => {
    try {
        const response = await apiClient.post(endpoint, data);
        return response.data;
    } catch (error) {
        console.error('Error posting data:', error);
        throw error;
    }
};

export const putData = async (endpoint: string, data: any) => {
    try {
        const response = await apiClient.put(endpoint, data);
        return response.data;
    } catch (error) {
        console.error('Error updating data:', error);
        throw error;
    }
};

export const deleteData = async (endpoint: string) => {
    try {
        const response = await apiClient.delete(endpoint);
        return response.data;
    } catch (error) {
        console.error('Error deleting data:', error);
        throw error;
    }
};