import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { BookingProvider } from './context/BookingContext'
import { AdminDashboard } from './pages/AdminDashboard'
import { Book } from './pages/Book'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { UserDashboard } from './pages/UserDashboard'

export default function App() {
  return (
    <AuthProvider>
      <BookingProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/book" element={<Book />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard/*" element={<UserDashboard />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </BookingProvider>
    </AuthProvider>
  )
}
