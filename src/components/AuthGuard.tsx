import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { 
  Lock, 
  Loader2, 
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading, login, signup } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);

  React.useEffect(() => {
    const checkUsers = async () => {
      try {
        const { collection, getDocs, query, limit } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
        setHasUsers(!usersSnap.empty);
        if (!usersSnap.empty) {
          setIsLogin(true);
        }
      } catch (err) {
        console.error("Error checking users:", err);
        setHasUsers(false); // Fallback to allow first signup if check fails
      }
    };
    checkUsers();
  }, []);

  if (loading || hasUsers === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthError('');
      setIsSubmitting(true);
      try {
        if (isLogin) {
          await login(email, password);
        } else {
          await signup(email, password, name);
        }
      } catch (err: any) {
        setAuthError(err.message || 'Authentication failed');
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg">
              <Lock size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">De Markt</h1>
            <p className="text-gray-500 text-sm mt-1">
              {isLogin ? 'Welcome back! Please login' : 'Create your admin account'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder="John Doe"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={16} />
                {authError}
              </div>
            )}

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              {isLogin ? 'Login' : 'Sign Up'}
            </button>
          </form>

          {!hasUsers && (
            <div className="mt-6 text-center">
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-blue-600 font-bold hover:underline"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};

export const PermissionGuard: React.FC<{ permission: string, children: React.ReactNode, fallback?: React.ReactNode }> = ({ permission, children, fallback = null }) => {
  const { role } = useAuth();
  
  if (!role || !(role.permissions as any)[permission]) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
