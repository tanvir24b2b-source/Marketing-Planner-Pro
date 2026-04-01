import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { 
  LayoutDashboard, 
  Lock, 
  Smartphone, 
  Loader2, 
  LogOut,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const PermissionGuard: React.FC<{ permission: string, children: React.ReactNode, fallback?: React.ReactNode }> = ({ permission, children, fallback = null }) => {
  return <>{children}</>;
};
