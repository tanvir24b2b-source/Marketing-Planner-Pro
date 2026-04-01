import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  serverTimestamp,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from './firebase';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  roleId: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt: any;
  lastLogin: any;
  trustedDevices: string[];
  profileImage?: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: {
    can_view_dashboard: boolean;
    can_view_products: boolean;
    can_add_products: boolean;
    can_edit_products: boolean;
    can_delete_products: boolean;
    can_view_buying_price: boolean;
    can_view_ads_plan: boolean;
    can_edit_ads_plan: boolean;
    can_view_content_plan: boolean;
    can_edit_content_plan: boolean;
    can_manage_users: boolean;
    can_manage_roles: boolean;
    can_manage_settings: boolean;
    can_approve_devices: boolean;
  };
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  role: Role | null;
  loading: boolean;
  isSetupComplete: boolean;
  isDeviceApproved: boolean;
  deviceId: string;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  requestDeviceApproval: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>({ uid: 'system-admin', email: 'admin@demarkt.com' } as any);
  const [profile, setProfile] = useState<UserProfile | null>({
    id: 'system-admin',
    name: 'System Administrator',
    email: 'admin@demarkt.com',
    roleId: 'admin',
    status: 'active',
    createdBy: 'system',
    createdAt: new Date(),
    lastLogin: new Date(),
    trustedDevices: []
  });
  const [role, setRole] = useState<Role | null>({
    id: 'admin',
    name: 'Administrator',
    permissions: {
      can_view_dashboard: true,
      can_view_products: true,
      can_add_products: true,
      can_edit_products: true,
      can_view_buying_price: true,
      can_view_ads_plan: true,
      can_edit_ads_plan: true,
      can_view_content_plan: true,
      can_edit_content_plan: true,
      can_manage_users: true,
      can_manage_roles: true,
      can_manage_settings: true,
      can_approve_devices: true,
      can_delete_products: true
    }
  });
  const [loading, setLoading] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(true);
  const [isDeviceApproved, setIsDeviceApproved] = useState(true);
  const [deviceId, setDeviceId] = useState('system-device');

  useEffect(() => {
    // Keep setup check for global settings if needed, but bypass auth
    const unsubSetup = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setIsSetupComplete(doc.data().isSetupComplete);
      }
    }, (error) => console.log('Setup check bypassed'));

    return () => unsubSetup();
  }, []);

  const login = async () => {};
  const signup = async () => {};
  const logout = async () => {};
  const requestDeviceApproval = async () => {};

  return (
    <AuthContext.Provider value={{ 
      user, profile, role, loading, isSetupComplete, isDeviceApproved, deviceId,
      login, signup, logout, requestDeviceApproval 
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
