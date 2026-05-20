import axios from "axios"


const api = axios.create({
    baseURL: "http://localhost:3000",
    withCredentials: true
})

api.interceptors.request.use((config) => {
    config.headers = config.headers || {}
    const token = window.localStorage.getItem("token")
    if (token) {
        config.headers = {
            ...config.headers,
            Authorization: `Bearer ${token}`
        }
    }
    return config
})

export async function register({ username, email, password }) {

    try {
        const response = await api.post('/api/auth/register', {
            username, email, password
        })

        if (response.data?.token) {
            window.localStorage.setItem("token", response.data.token)
        }

        return response.data

    } catch (err) {
        console.log("Register error:", err)
        throw err
    }

}

export async function login({ email, password }) {

    try {

        const response = await api.post("/api/auth/login", {
            email, password
        })

        if (response.data?.token) {
            window.localStorage.setItem("token", response.data.token)
        }

        return response.data

    } catch (err) {
        console.log("Login error:", err)
        throw err
    }

}

export async function logout() {
    try {

        const response = await api.get("/api/auth/logout")
        window.localStorage.removeItem("token")
        return response.data

    } catch (err) {
        console.log("Logout error:", err)
        throw err
    }
}

export async function getMe() {

    try {

        const response = await api.get("/api/auth/get-me")

        return response.data

    } catch (err) {
        console.log("GetMe error:", err)
        throw err
    }

}