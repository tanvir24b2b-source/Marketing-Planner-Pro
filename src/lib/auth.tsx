import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword,
  User as FirebaseUser,
  getAuth,
  initializeAuth
} from 'firebase/auth';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs,
  query, 
  limit,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { auth, db, firebaseConfig } from './firebase';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  roleId: string;
  profileImage?: string;
  createdAt: any;
}

export interface Role {
  id: string;
  name: string;
  permissions: {
    viewProducts: boolean;
    seeBuyingPrice: boolean;
    editProducts: boolean;
    viewContentPlan: boolean;
    editContentPlan: boolean;
    viewAdsPlan: boolean;
    editAdsPlan: boolean;
    manageUsers: boolean;
  };
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  role: Role | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateMyProfile: (data: { name?: string; profileImage?: string }) => Promise<void>;
  changeMyPassword: (newPass: string) => Promise<void>;
  adminCreateUser: (email: string, pass: string, name: string, roleId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Fetch profile
        const profileRef = doc(db, 'users', firebaseUser.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          const profileData = profileSnap.data() as UserProfile;
          setProfile(profileData);
          
          // Fetch role
          const roleRef = doc(db, 'roles', profileData.roleId);
          const roleSnap = await getDoc(roleRef);
          if (roleSnap.exists()) {
            setRole(roleSnap.data() as Role);
          }
        }
      } else {
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signup = async (email: string, pass: string, name: string) => {
    const userCred = await createUserWithEmailAndPassword(auth, email, pass);
    const firebaseUser = userCred.user;

    // Check if this is the first user
    const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
    const isFirstUser = usersSnap.empty;
    const roleId = isFirstUser ? 'admin' : 'user';

    // If first user, ensure admin role exists
    if (isFirstUser) {
      const adminRoleRef = doc(db, 'roles', 'admin');
      const adminRoleSnap = await getDoc(adminRoleRef);
      if (!adminRoleSnap.exists()) {
        await setDoc(adminRoleRef, {
          id: 'admin',
          name: 'Administrator',
          permissions: {
            viewProducts: true,
            seeBuyingPrice: true,
            editProducts: true,
            viewContentPlan: true,
            editContentPlan: true,
            viewAdsPlan: true,
            editAdsPlan: true,
            manageUsers: true
          }
        });
      }
      
      // Also ensure default user role exists
      const userRoleRef = doc(db, 'roles', 'user');
      const userRoleSnap = await getDoc(userRoleRef);
      if (!userRoleSnap.exists()) {
        await setDoc(userRoleRef, {
          id: 'user',
          name: 'User',
          permissions: {
            viewProducts: true,
            seeBuyingPrice: false,
            editProducts: false,
            viewContentPlan: true,
            editContentPlan: false,
            viewAdsPlan: true,
            editAdsPlan: false,
            manageUsers: false
          }
        });
      }
    }

    const newProfile: UserProfile = {
      id: firebaseUser.uid,
      name,
      email,
      roleId,
      createdAt: serverTimestamp()
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
    await updateProfile(firebaseUser, { displayName: name });
    
    setProfile(newProfile);
    const roleSnap = await getDoc(doc(db, 'roles', roleId));
    if (roleSnap.exists()) {
      setRole(roleSnap.data() as Role);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateMyProfile = async (data: { name?: string; profileImage?: string }) => {
    if (!user) return;
    const profileRef = doc(db, 'users', user.uid);
    await updateDoc(profileRef, data);
    if (data.name) {
      await updateProfile(user, { displayName: data.name });
    }
    setProfile(prev => prev ? { ...prev, ...data } : null);
  };

  const changeMyPassword = async (newPass: string) => {
    if (!user) return;
    await updatePassword(user, newPass);
  };

  const adminCreateUser = async (email: string, pass: string, name: string, roleId: string) => {
    // Create a secondary app to create the user without logging out the admin
    const secondaryApp = getApps().find(app => app.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
    const secondaryAuth = getAuth(secondaryApp);
    
    try {
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      const newUser = userCred.user;
      
      await setDoc(doc(db, 'users', newUser.uid), {
        id: newUser.uid,
        name,
        email,
        roleId,
        createdAt: serverTimestamp()
      });
      
      await updateProfile(newUser, { displayName: name });
      await signOut(secondaryAuth);
    } catch (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, profile, role, loading,
      login, signup, logout, updateMyProfile, changeMyPassword, adminCreateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
