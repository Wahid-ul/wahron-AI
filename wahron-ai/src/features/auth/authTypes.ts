export interface User {
  id: string
  email: string
  full_name: string
}

export interface AuthResponse {
  user: User
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  full_name: string
  email: string
  password: string
}