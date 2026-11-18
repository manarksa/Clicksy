import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Assistant } from './components/Assistant'
import { StudioIntro } from './components/StudioIntro'
import { AuthProvider } from './context/AuthContext'
import { BookingProvider } from './context/BookingContext'
import { LanguageProvider } from './context/LanguageContext'
import { AdminDashboard } from './pages/AdminDashboard'
import { Book } from './pages/Book'
import { Help } from './pages/Help'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Packages } from './pages/Packages'
import { UserDashboard } from './pages/UserDashboard'

function ScrollToHash() {
  const { hash, pathname } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash, pathname])

  return null
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BookingProvider>
          <BrowserRouter>
            <StudioIntro>
              <ScrollToHash />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/packages" element={<Packages />} />
                <Route path="/book" element={<Book />} />
                <Route path="/help" element={<Help />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard/*" element={<UserDashboard />} />
                <Route path="/admin/*" element={<AdminDashboard />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <Assistant />
            </StudioIntro>
          </BrowserRouter>
        </BookingProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}
