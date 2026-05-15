'use client'

import { useState, useEffect, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, User, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react'

const AUTH_STORAGE_KEY = 'milbox25_auth_session'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 초기 로딩 시 localStorage에서 세션 확인
  useEffect(() => {
    const checkSession = () => {
      try {
        const session = localStorage.getItem(AUTH_STORAGE_KEY)
        if (session) {
          const parsed = JSON.parse(session)
          // 세션 유효성 검사 (24시간 만료)
          if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            setAuthStatus('authenticated')
            return
          }
          // 만료된 세션 삭제
          localStorage.removeItem(AUTH_STORAGE_KEY)
        }
        setAuthStatus('unauthenticated')
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY)
        setAuthStatus('unauthenticated')
      }
    }
    checkSession()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    // 환경변수 확인
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD

    if (!adminPassword) {
      setError('시스템 설정 오류: 관리자 비밀번호가 설정되지 않았습니다. 관리자에게 문의하세요.')
      setIsSubmitting(false)
      return
    }

    // 아이디 검증
    if (username !== 'admin') {
      setError('아이디가 올바르지 않습니다.')
      setIsSubmitting(false)
      return
    }

    // 비밀번호 검증
    if (password !== adminPassword) {
      setError('비밀번호가 올바르지 않습니다.')
      setIsSubmitting(false)
      return
    }

    // 로그인 성공 - localStorage에 세션 저장
    const session = {
      authenticated: true,
      timestamp: Date.now(),
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
    setAuthStatus('authenticated')
    setIsSubmitting(false)
  }

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setAuthStatus('unauthenticated')
    setUsername('')
    setPassword('')
  }

  // 로딩 중
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">세션 확인 중...</p>
        </div>
      </div>
    )
  }

  // 인증되지 않은 경우 - 로그인 페이지 표시
  if (authStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* 로고 및 타이틀 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">밀박스25 큐레이션</h1>
            <p className="text-muted-foreground mt-2">관리자 로그인이 필요합니다</p>
          </div>

          {/* 로그인 폼 */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="space-y-4">
                {/* 아이디 입력 */}
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-foreground">아이디</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="admin"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10"
                      autoComplete="username"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* 비밀번호 입력 */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">비밀번호</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="비밀번호를 입력하세요"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      autoComplete="current-password"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 에러 메시지 */}
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
              </div>

              {/* 로그인 버튼 */}
              <Button
                type="submit"
                className="w-full mt-6 gap-2"
                disabled={isSubmitting || !username || !password}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    로그인 중...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    로그인
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* 안내 문구 */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            원가 정보 보호를 위해 인증이 필요합니다.
            <br />
            로그인 정보는 관리자에게 문의하세요.
          </p>
        </div>
      </div>
    )
  }

  // 인증된 경우 - 자식 컴포넌트 렌더링 + 로그아웃 버튼 컨텍스트 제공
  return (
    <AuthContext.Provider value={{ handleLogout }}>
      {children}
    </AuthContext.Provider>
  )
}

// 로그아웃 함수를 제공하는 컨텍스트
import { createContext, useContext } from 'react'

interface AuthContextType {
  handleLogout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
