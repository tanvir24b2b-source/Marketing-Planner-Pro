/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  Megaphone, 
  Settings, 
  Menu, 
  LogOut, 
  User as UserIcon,
  Clock,
  MessageSquare,
  TrendingUp,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  X,
  Sparkles,
  Loader2,
  Upload,
  Copy,
  CheckCircle2,
  Circle,
  Archive,
  Calendar,
  Layout,
  Globe,
  Video,
  Play,
  Send,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Users,
  Key,
  Shield,
  Eye,
  EyeOff,
  PlusCircle,
  MoreVertical,
  Check,
  Ban,
  RefreshCcw,
  Camera,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Papa from 'papaparse';
import { toast, Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth, UserProfile, Role } from './lib/auth';
import { AuthGuard, PermissionGuard } from './components/AuthGuard';
import { db, auth, OperationType, handleFirestoreError } from './lib/firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy,
  setDoc,
  getDocs,
  getDoc,
  getDocFromServer
} from 'firebase/firestore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Test Firestore Connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
testConnection();

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends (Component as any) {
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) {
          errorMessage = `Firestore Error: ${parsed.error} (Operation: ${parsed.operationType})`;
        }
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-red-100">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <Shield className="w-8 h-8" />
              <h2 className="text-xl font-bold">System Error</h2>
            </div>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        <Toaster position="top-right" />
        {(this.props as any).children}
      </>
    );
  }
}

interface Product {
  id: string;
  name: string;
  buyingPrice: number;
  sellingPrice: number;
  websiteLink: string;
  videos?: AdVideo[];
}

interface ContentPlanItem {
  id: string;
  date: string;
  type: string;
  theme: string;
  visualDescription: string;
  caption: string;
  isDone: boolean;
}

interface ArchivedPlan {
  id: string;
  month: string;
  items: ContentPlanItem[];
  archivedAt: string;
}

type AdStatus = 'Pending' | 'Ready for Ad' | 'Live Ad' | 'Stopped';

interface AdVideo {
  id: string;
  url: string;
  thumbnail?: string;
}

interface AdNote {
  id: string;
  text: string;
  createdAt: string;
  isDone?: boolean;
}

interface AdProduct {
  id: string;
  productId: string;
  name: string;
  status: AdStatus;
  startTime?: string;
  endTime?: string;
  videos: AdVideo[];
  notes: AdNote[];
  platform: 'facebook' | 'tiktok' | 'google';
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
}

const StatCard = ({ title, value, icon, color = "text-gray-400" }: StatCardProps) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between h-32"
  >
    <div className="flex justify-between items-start">
      <span className="text-sm font-medium text-gray-500">{title}</span>
      <div className={color}>{icon}</div>
    </div>
    <div className={`text-3xl font-bold ${color === 'text-gray-400' ? 'text-gray-900' : color}`}>
      {value}
    </div>
  </motion.div>
);

const SidebarItem = ({ 
  icon, 
  label, 
  active = false, 
  isOpen = true,
  onClick 
}: { 
  icon: React.ReactNode, 
  label: string, 
  active?: boolean, 
  isOpen?: boolean,
  onClick: () => void
}) => (
  <div 
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer transition-colors ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'} ${!isOpen ? 'justify-center' : ''}`}
  >
    <div className="flex-shrink-0">{icon}</div>
    {isOpen && (
      <motion.span 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="font-medium text-sm whitespace-nowrap overflow-hidden"
      >
        {label}
      </motion.span>
    )}
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthGuard>
          <AppContent />
        </AuthGuard>
      </AuthProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { profile, role, logout, updateMyProfile, changeMyPassword, adminCreateUser } = useAuth();
  const user = profile;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'content-plan' | 'ads-plan' | 'settings'>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [contentPlan, setContentPlan] = useState<ContentPlanItem[]>([]);
  const [archivedPlans, setArchivedPlans] = useState<ArchivedPlan[]>([]);
  const [adProducts, setAdProducts] = useState<AdProduct[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [deviceRequests, setDeviceRequests] = useState<any[]>([]);

  const [isImportAdModalOpen, setIsImportAdModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [adPlatform, setAdPlatform] = useState<'facebook' | 'tiktok' | 'google'>('facebook');
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newNoteText, setNewNoteText] = useState('');

  const [profileForm, setProfileForm] = useState({
    name: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (profile) {
      setProfileForm(prev => ({ ...prev, name: profile.name }));
    }
  }, [profile]);

  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast.error('Image size should be less than 1MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateMyProfile({ profileImage: base64String });
        toast.success('Profile picture updated');
      } catch (error) {
        toast.error('Failed to update profile picture');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async () => {
    try {
      if (profileForm.name !== profile?.name) {
        await updateMyProfile({ name: profileForm.name });
        toast.success('Name updated');
      }

      if (profileForm.password) {
        if (profileForm.password !== profileForm.confirmPassword) {
          toast.error('Passwords do not match');
          return;
        }
        if (profileForm.password.length < 6) {
          toast.error('Password must be at least 6 characters');
          return;
        }
        await changeMyPassword(profileForm.password);
        toast.success('Password updated');
        setProfileForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    }
  };

  // Firestore Subscriptions
  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'products'));

    const unsubContent = onSnapshot(collection(db, 'content_plans'), (snapshot) => {
      setContentPlan(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPlanItem)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'content_plans'));

    const unsubAdProducts = onSnapshot(collection(db, 'ad_products'), (snapshot) => {
      setAdProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdProduct)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'ad_products'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    const unsubRoles = onSnapshot(collection(db, 'roles'), (snapshot) => {
      setRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'roles'));

    const unsubDevices = onSnapshot(collection(db, 'device_requests'), (snapshot) => {
      setDeviceRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'device_requests'));

    return () => {
      unsubProducts();
      unsubContent();
      unsubAdProducts();
      unsubUsers();
      unsubRoles();
      unsubDevices();
    };
  }, []);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  
  // Form State
  const [newProduct, setNewProduct] = useState({
    name: '',
    buyingPrice: '',
    sellingPrice: '',
    websiteLink: ''
  });
  const [isFetching, setIsFetching] = useState(false);
  const [contentSubTab, setContentSubTab] = useState<'calendar' | 'ideas'>('calendar');
  const [settingsSubTab, setSettingsSubTab] = useState<'profile' | 'users' | 'roles' | 'devices'>('profile');

  const handleSaveUser = async (userData: any) => {
    try {
      const { email, password, name, roleId, id } = userData;

      if (id) {
        if (!name || !roleId) {
          toast.error('Name and Role are required');
          return;
        }
        await updateDoc(doc(db, 'users', id), {
          name,
          roleId,
          updatedAt: serverTimestamp()
        });
        toast.success('User updated successfully');
      } else {
        // Robust validation for new user creation
        if (!email || typeof email !== 'string' || email.trim() === '') {
          toast.error('Valid email is required');
          return;
        }
        if (!password || typeof password !== 'string' || password.length < 6) {
          toast.error('Password must be at least 6 characters');
          return;
        }
        if (!name || typeof name !== 'string' || name.trim() === '') {
          toast.error('Name is required');
          return;
        }
        if (!roleId) {
          toast.error('Role is required');
          return;
        }

        await adminCreateUser(email.trim(), password, name.trim(), roleId);
        toast.success('User created successfully');
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast.error(error.message || 'Failed to save user');
    }
  };

  const handleSaveRole = async (roleData: any) => {
    try {
      if (roleData.id) {
        const { id, ...data } = roleData;
        await updateDoc(doc(db, 'roles', id), {
          ...data,
          updatedAt: serverTimestamp()
        });
        toast.success('Role updated successfully');
      } else {
        await addDoc(collection(db, 'roles'), {
          ...roleData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success('Role created successfully');
      }
      setIsRoleModalOpen(false);
      setEditingRole(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'roles');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success('User deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    try {
      await deleteDoc(doc(db, 'roles', roleId));
      toast.success('Role deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'roles');
    }
  };

  const handleApproveDevice = async (requestId: string) => {
    try {
      const request = deviceRequests.find(r => r.id === requestId);
      if (!request) return;

      const userRef = doc(db, 'users', request.userId);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) return;

      const userData = userDoc.data();
      const trustedDevices = userData.trustedDevices || [];
      
      if (!trustedDevices.includes(request.deviceId)) {
        await updateDoc(userRef, {
          trustedDevices: [...trustedDevices, request.deviceId]
        });
      }

      await updateDoc(doc(db, 'device_requests', requestId), {
        status: 'approved',
        approvedAt: serverTimestamp()
      });

      toast.success('Device approved successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'device_requests');
    }
  };

  const handleRejectDevice = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'device_requests', requestId), {
        status: 'rejected',
        rejectedAt: serverTimestamp()
      });
      toast.success('Device request rejected');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'device_requests');
    }
  };
  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      Papa.parse(file, {
        header: true,
        complete: async (results) => {
          const batch = results.data
            .filter((row: any) => row.Date || row.Type || row.Caption)
            .map((row: any) => ({
              date: row.Date || '',
              type: row.Type || '',
              theme: row['Theme / Product'] || row.Theme || '',
              visualDescription: row['Visual Description'] || '',
              caption: row['Copy Caption'] || row.Caption || '',
              isDone: false,
              createdAt: serverTimestamp()
            }));
          
          for (const item of batch) {
            await addDoc(collection(db, 'content_plans'), item);
          }
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'content_plans');
    }
    // Reset input
    event.target.value = '';
  };

  const handleArchivePlan = async () => {
    if (contentPlan.length === 0) return;
    
    try {
      // In Firestore, we delete them or mark them as archived. 
      // For now, let's just delete them as per original logic's "clear" behavior
      for (const item of contentPlan) {
        await deleteDoc(doc(db, 'content_plans', item.id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'content_plans');
    }
  };

  const toggleContentDone = async (id: string) => {
    const item = contentPlan.find(i => i.id === id);
    if (item) {
      try {
        await updateDoc(doc(db, 'content_plans', id), { isDone: !item.isDone });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'content_plans');
      }
    }
  };

  const deleteContentItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'content_plans', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'content_plans');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleSaveProduct = async () => {
    if (!newProduct.name || !newProduct.buyingPrice || !newProduct.sellingPrice) return;
    
    const productData = {
      name: newProduct.name,
      buyingPrice: parseFloat(newProduct.buyingPrice),
      sellingPrice: parseFloat(newProduct.sellingPrice),
      websiteLink: newProduct.websiteLink,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingProductId) {
        await updateDoc(doc(db, 'products', editingProductId), productData);
        // Update name in ad products too
        const q = query(collection(db, 'ad_products'), where('productId', '==', editingProductId));
        const snapshot = await getDocs(q);
        snapshot.forEach(async (d) => {
          await updateDoc(doc(db, 'ad_products', d.id), { name: newProduct.name });
        });
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: serverTimestamp()
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleImportToAds = async (product: Product) => {
    const alreadyImported = adProducts.some(ap => ap.productId === product.id && ap.platform === adPlatform);
    if (alreadyImported) {
      setIsImportAdModalOpen(false);
      return;
    }

    const newAdProduct = {
      productId: product.id,
      name: product.name,
      status: 'Pending',
      videos: product.videos || [],
      notes: [],
      platform: adPlatform,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'ad_products'), newAdProduct);
      setIsImportAdModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'ad_products');
    }
  };

  const toggleNoteDone = async (adProductId: string, noteId: string) => {
    const ap = adProducts.find(a => a.id === adProductId);
    if (!ap) return;

    const updatedNotes = ap.notes.map(n => 
      n.id === noteId ? { ...n, isDone: !n.isDone } : n
    );

    try {
      await updateDoc(doc(db, 'ad_products', adProductId), { notes: updatedNotes });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'ad_products');
    }
  };

  const handleStatusChange = async (id: string, newStatus: AdStatus) => {
    const ap = adProducts.find(a => a.id === id);
    if (!ap) return;

    let startTime = ap.startTime || null;
    let endTime = ap.endTime || null;

    if (newStatus === 'Live Ad' && ap.status !== 'Live Ad') {
      startTime = new Date().toISOString();
    } else if (newStatus === 'Stopped' && ap.status === 'Live Ad') {
      endTime = new Date().toISOString();
    }

    try {
      await updateDoc(doc(db, 'ad_products', id), { 
        status: newStatus, 
        startTime, 
        endTime 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'ad_products');
    }
  };

  const formatUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
  };

  const fetchThumbnail = async (url: string): Promise<string | undefined> => {
    // YouTube Support
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([^\?&"'>]+)/);
    if (youtubeMatch && youtubeMatch[1]) {
      return `https://img.youtube.com/vi/${youtubeMatch[1]}/mqdefault.jpg`;
    }

    // Google Drive Thumbnail
    const driveMatch = url.match(/\/file\/d\/([^\/]+)/) || url.match(/id=([^\&]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${driveMatch[1]}=s400`;
    }

    // Try NoEmbed for faster metadata (works for TikTok, Instagram, etc.)
    try {
      const noEmbedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
      const noEmbedData = await noEmbedRes.json();
      if (noEmbedData.thumbnail_url) {
        return noEmbedData.thumbnail_url;
      }
    } catch (e) {
      console.warn("NoEmbed fetch failed, falling back to Gemini.");
    }

    // Try to get thumbnail using Gemini for Facebook/TikTok/Instagram
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find the primary thumbnail image URL (og:image) for this video link: ${url}. 
        Return ONLY the raw URL string. If not found, return 'none'. 
        If it's a Facebook or Instagram link, try to find the actual image content URL.`,
        config: {
          tools: [{urlContext: {}}]
        },
      });
      const thumbUrl = response.text?.trim();
      if (thumbUrl && thumbUrl !== 'none' && thumbUrl.startsWith('http')) {
        return thumbUrl;
      }
    } catch (error) {
      console.error("Error fetching thumbnail:", error);
    }
    return undefined;
  };

  const getEmbedUrl = (url: string) => {
    // YouTube
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([^\?&"'>]+)/);
    if (youtubeMatch && youtubeMatch[1]) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1`;
    }

    // TikTok
    const tiktokMatch = url.match(/tiktok\.com\/.*\/video\/(\d+)/) || url.match(/tiktok\.com\/v\/(\d+)/);
    if (tiktokMatch && tiktokMatch[1]) {
      return `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`;
    }

    // Facebook
    if (url.includes('facebook.com') || url.includes('fb.watch')) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&t=0`;
    }

    // Instagram
    const instaMatch = url.match(/instagram\.com\/(?:p|reels|reel)\/([^\/?#&]+)/);
    if (instaMatch && instaMatch[1]) {
      return `https://www.instagram.com/p/${instaMatch[1]}/embed`;
    }

    return url;
  };

  const handleAddVideo = async (adId: string) => {
    if (!newVideoUrl) return;
    const formattedUrl = formatUrl(newVideoUrl);
    const videoId = Math.random().toString(36).substr(2, 9);
    
    const ap = adProducts.find(a => a.id === adId);
    if (!ap) return;

    const newVideo = { id: videoId, url: formattedUrl };
    try {
      await updateDoc(doc(db, 'ad_products', adId), {
        videos: [...ap.videos, newVideo]
      });
      
      setNewVideoUrl('');

      // Fetch thumbnail in background
      fetchThumbnail(formattedUrl).then(async (thumbnail) => {
        try {
          const currentApDoc = await getDoc(doc(db, 'ad_products', adId));
          if (!currentApDoc.exists()) return;
          const currentAp = currentApDoc.data() as AdProduct;
          const updatedVideos = currentAp.videos.map(v => 
            v.id === videoId ? { ...v, thumbnail: thumbnail || 'failed' } : v
          );
          await updateDoc(doc(db, 'ad_products', adId), { videos: updatedVideos });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'ad_products');
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'ad_products');
    }
  };

  const handleDeleteVideo = async (adId: string, videoId: string) => {
    const ap = adProducts.find(a => a.id === adId);
    if (!ap) return;

    try {
      await updateDoc(doc(db, 'ad_products', adId), {
        videos: ap.videos.filter(v => v.id !== videoId)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'ad_products');
    }
  };

  const handleAddProductVideo = async (productId: string) => {
    if (!newVideoUrl) return;
    const formattedUrl = formatUrl(newVideoUrl);
    const videoId = Math.random().toString(36).substr(2, 9);
    
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newVideo = { id: videoId, url: formattedUrl };
    try {
      await updateDoc(doc(db, 'products', productId), {
        videos: [...(product.videos || []), newVideo]
      });
      
      setNewVideoUrl('');

      // Fetch thumbnail in background
      fetchThumbnail(formattedUrl).then(async (thumbnail) => {
        try {
          const currentDoc = await getDoc(doc(db, 'products', productId));
          if (!currentDoc.exists()) return;
          const currentData = currentDoc.data() as Product;
          const updatedVideos = (currentData.videos || []).map(v => 
            v.id === videoId ? { ...v, thumbnail: thumbnail || 'failed' } : v
          );
          await updateDoc(doc(db, 'products', productId), { videos: updatedVideos });
        } catch (error) {
          console.error("Thumbnail update failed:", error);
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleDeleteProductVideo = async (productId: string, videoId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    try {
      await updateDoc(doc(db, 'products', productId), {
        videos: (product.videos || []).filter(v => v.id !== videoId)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleAddNote = async (adId: string) => {
    if (!newNoteText) return;
    const ap = adProducts.find(a => a.id === adId);
    if (!ap) return;

    const newNote = { 
      id: Math.random().toString(36).substr(2, 9), 
      text: newNoteText, 
      createdAt: new Date().toLocaleString() 
    };

    try {
      await updateDoc(doc(db, 'ad_products', adId), {
        notes: [...ap.notes, newNote]
      });
      setNewNoteText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'ad_products');
    }
  };

  const deleteAdProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'ad_products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'ad_products');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
    }
  };

  const openAddModal = () => {
    setEditingProductId(null);
    setNewProduct({ name: '', buyingPrice: '', sellingPrice: '', websiteLink: '' });
    setIsAddModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProductId(product.id);
    setNewProduct({
      name: product.name,
      buyingPrice: product.buyingPrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      websiteLink: product.websiteLink
    });
    setIsAddModalOpen(true);
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingProductId(null);
    setNewProduct({ name: '', buyingPrice: '', sellingPrice: '', websiteLink: '' });
  };

  const generateAdCopy = async (ad: AdProduct) => {
    const product = products.find(p => p.id === ad.productId);
    if (!product) return;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate high-converting Facebook/TikTok ad copy for this product:
        Name: ${product.name}
        Price: ৳${product.sellingPrice}
        Platform: ${ad.platform}
        
        The copy should be in Banglish (Bengali written in English script) and include:
        1. Hook (Attention grabber)
        2. Problem (The pain point)
        3. Solution (How this product helps)
        4. CTA (Order link: ${product.websiteLink})
        
        Output format: JSON with keys "hook", "problem", "solution", "cta".`,
        config: { responseMimeType: "application/json" }
      });
      
      const copy = JSON.parse(response.text || '{}');
      const formattedCopy = `${copy.hook}\n\n${copy.problem}\n\n${copy.solution}\n\n${copy.cta}`;
      
      // Add as a note
      await handleAddNote(ad.id); // This is a bit hacky, let's just update the state or show a modal
      alert("AI Ad Copy Generated! Check console for now.");
      console.log(formattedCopy);
    } catch (error) {
      console.error("Error generating ad copy:", error);
    }
  };

  const generateWhatsAppMessage = async (product: Product) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a short, friendly WhatsApp marketing message for:
        Product: ${product.name}
        Price: ৳${product.sellingPrice}
        Link: ${product.websiteLink}
        
        Language: Bengali (Bangla script)
        Tone: Professional yet friendly.
        Include emojis.`,
      });
      
      const msg = response.text?.trim();
      alert("AI WhatsApp Message Generated!\n\n" + msg);
    } catch (error) {
      console.error("Error generating WhatsApp message:", error);
    }
  };

  const fetchProductInfo = async () => {
    if (!newProduct.websiteLink) return;
    setIsFetching(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract the actual product name and the current selling price (sale price) visible on this website: ${newProduct.websiteLink}. 
        Do not guess. If you cannot find the price, return 0 for sellingPrice.
        Return ONLY a JSON object with keys "name" (string) and "sellingPrice" (number).`,
        config: { 
          responseMimeType: "application/json",
          tools: [{ urlContext: {} }]
        }
      });
      
      const data = JSON.parse(response.text || '{}');
      if (data.name || data.sellingPrice) {
        setNewProduct(prev => ({
          ...prev,
          name: data.name || prev.name,
          sellingPrice: data.sellingPrice > 0 ? data.sellingPrice.toString() : prev.sellingPrice
        }));
      }
    } catch (error) {
      console.error("Error fetching product info:", error);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8F9FB] font-sans text-gray-900 relative">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        bg-white border-r border-gray-200 transition-all duration-300 flex flex-col
        fixed lg:relative inset-y-0 left-0 z-50
        ${isSidebarOpen 
          ? 'translate-x-0 w-64' 
          : '-translate-x-full lg:translate-x-0 lg:w-20'
        }
      `}>
        <div className="p-4 flex-1">
          <div className="flex flex-col gap-2">
            <SidebarItem 
              icon={<LayoutDashboard size={20} />} 
              label="Dashboard" 
              active={activeTab === 'dashboard'} 
              isOpen={isSidebarOpen}
              onClick={() => setActiveTab('dashboard')}
            />
            <PermissionGuard permission="viewProducts">
              <SidebarItem 
                icon={<Package size={20} />} 
                label="Products" 
                active={activeTab === 'products'} 
                isOpen={isSidebarOpen}
                onClick={() => setActiveTab('products')}
              />
            </PermissionGuard>
            <PermissionGuard permission="viewContentPlan">
              <SidebarItem 
                icon={<FileText size={20} />} 
                label="Content Plan" 
                active={activeTab === 'content-plan'}
                isOpen={isSidebarOpen} 
                onClick={() => setActiveTab('content-plan')} 
              />
            </PermissionGuard>
            <PermissionGuard permission="viewAdsPlan">
              <SidebarItem 
                icon={<Megaphone size={20} />} 
                label="Ads Plan" 
                active={activeTab === 'ads-plan'}
                isOpen={isSidebarOpen} 
                onClick={() => setActiveTab('ads-plan')} 
              />
            </PermissionGuard>
            <SidebarItem 
              icon={<Settings size={20} />} 
              label="Settings" 
              active={activeTab === 'settings'}
              isOpen={isSidebarOpen} 
              onClick={() => setActiveTab('settings')} 
            />
          </div>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 overflow-hidden">
              {profile?.profileImage ? (
                <img src={profile.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={20} />
              )}
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col">
                <span className="text-sm font-bold truncate max-w-[120px]">{profile?.name}</span>
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                  {role?.name}
                </span>
              </div>
            )}
          </div>
          {isSidebarOpen && (
            <button 
              onClick={logout}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 justify-between">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu size={20} className="text-gray-600" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">De Markt</h1>
          <div className="w-10" />
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'dashboard' ? (
              <>
                <h2 className="text-2xl font-bold mb-8">Dashboard</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <StatCard title="Total Products" value={products.length} icon={<Package size={20} />} />
                  <StatCard title="Content Ideas" value={contentPlan.length} icon={<FileText size={20} />} />
                  <StatCard 
                    title="Products in Live Ad" 
                    value={adProducts.filter(ap => ap.status === 'Live Ad').length} 
                    icon={<Megaphone size={20} />} 
                    color="text-green-500" 
                  />
                  <StatCard 
                    title="Products Ready for Ad" 
                    value={adProducts.filter(ap => ap.status === 'Ready for Ad').length} 
                    icon={<TrendingUp size={20} />} 
                    color="text-blue-500" 
                  />
                  <PermissionGuard permission="seeBuyingPrice">
                    <StatCard 
                      title="Total Inventory Value" 
                      value={`৳${products.reduce((acc, p) => acc + (p.buyingPrice || 0), 0).toLocaleString()}`} 
                      icon={<TrendingUp size={20} />} 
                      color="text-purple-500" 
                    />
                  </PermissionGuard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 min-h-[400px] flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <Clock size={20} className="text-blue-600" />
                        <h3 className="font-bold text-lg">Today's Content Plan</h3>
                        <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full ml-2">
                          {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      {contentPlan.filter(item => {
                        const today = new Date().toISOString().split('T')[0];
                        return item.date === today;
                      }).length > 0 ? (
                        <div className="space-y-4">
                          {contentPlan.filter(item => {
                            const today = new Date().toISOString().split('T')[0];
                            return item.date === today;
                          }).map(item => (
                            <div key={item.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                              <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm">
                                <Calendar size={18} />
                              </div>
                              <div>
                                <p className="font-bold text-sm text-blue-900">{item.theme}</p>
                                <p className="text-xs text-blue-600 font-medium uppercase">{item.type}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                          <Clock size={48} className="mb-4 opacity-20" />
                          <p className="text-sm italic">No posts scheduled for today.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 min-h-[400px] flex flex-col"
                  >
                    <div className="flex items-center gap-2 mb-6">
                      <MessageSquare size={20} className="text-blue-600" />
                      <h3 className="font-bold text-lg">Ad Plan Feedback & Notes</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                      {adProducts.some(ap => ap.notes.length > 0) ? (
                        <div className="space-y-4">
                          {adProducts.flatMap(ap => ap.notes.map(note => ({ ...note, adProductId: ap.id, productName: ap.name, platform: ap.platform })))
                            .sort((a, b) => {
                              if (a.isDone === b.isDone) {
                                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                              }
                              return a.isDone ? 1 : -1;
                            })
                            .map(note => (
                              <div key={note.id} className={cn(
                                "p-4 rounded-xl border transition-all flex justify-between items-start gap-4",
                                note.isDone ? "bg-gray-50 border-gray-100 opacity-60" : "bg-blue-50/30 border-blue-100 shadow-sm"
                              )}>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start mb-2">
                                    <span className={cn(
                                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                                      note.isDone ? "bg-gray-200 text-gray-500" : "bg-blue-100 text-blue-600"
                                    )}>
                                      {note.productName} ({note.platform})
                                    </span>
                                    <span className="text-[10px] text-gray-400">{new Date(note.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <p className={cn(
                                    "text-sm text-gray-700 italic leading-relaxed",
                                    note.isDone && "line-through text-gray-400"
                                  )}>
                                    "{note.text}"
                                  </p>
                                </div>
                                <button
                                  onClick={() => toggleNoteDone(note.adProductId, note.id)}
                                  className={cn(
                                    "p-2 rounded-lg transition-all flex-shrink-0",
                                    note.isDone 
                                      ? "bg-green-100 text-green-600 hover:bg-green-200" 
                                      : "bg-white text-gray-400 hover:text-blue-600 border border-gray-200 shadow-sm"
                                  )}
                                  title={note.isDone ? "Mark as Pending" : "Mark as Done"}
                                >
                                  {note.isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                </button>
                              </div>
                            ))
                          }
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center px-12">
                          <MessageSquare size={48} className="mb-4 opacity-20" />
                          <p className="text-sm italic">No feedback or notes added yet. Add them from the Ads Plan section.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* Archived Plans / Previous Month Report */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
                >
                  <div className="flex items-center gap-2 mb-6">
                    <Archive size={20} className="text-blue-600" />
                    <h3 className="font-bold text-lg">Previous Month Reports</h3>
                  </div>
                  {archivedPlans.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {archivedPlans.map(plan => (
                        <div key={plan.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 transition-colors cursor-pointer group">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-gray-900 group-hover:text-blue-600">{plan.month}</span>
                            <span className="text-[10px] text-gray-400">{new Date(plan.archivedAt).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 size={12} className="text-green-500" />
                              {plan.items.filter(i => i.isDone).length} Done
                            </span>
                            <span className="flex items-center gap-1">
                              <Circle size={12} className="text-gray-300" />
                              {plan.items.filter(i => !i.isDone).length} Pending
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-gray-400 text-center">
                      <Archive size={48} className="mb-4 opacity-20" />
                      <p className="text-sm italic">No archived plans yet. Complete a month's plan to see reports here.</p>
                    </div>
                  )}
                </motion.div>
              </>
            ) : activeTab === 'products' ? (
              <>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                  <h2 className="text-xl sm:text-2xl font-bold">Products</h2>
                  <button 
                    onClick={openAddModal}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg flex items-center gap-2 text-sm sm:text-base font-medium transition-colors shadow-sm whitespace-nowrap"
                  >
                    <Plus size={18} />
                    Add Product
                  </button>
                </div>

                {/* Products Table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Name</th>
                        <PermissionGuard permission="seeBuyingPrice">
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Buying Price</th>
                        </PermissionGuard>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Selling Price</th>
                        <PermissionGuard permission="seeBuyingPrice">
                          <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Margin</th>
                        </PermissionGuard>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Website</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {products.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">
                            No products added yet. Click "Add Product" to get started.
                          </td>
                        </tr>
                      ) : (
                        products.map((product) => (
                          <React.Fragment key={product.id}>
                            <tr className="hover:bg-gray-50 transition-colors">
                              <td 
                                className="px-6 py-4 font-bold text-blue-600 cursor-pointer hover:underline"
                                onClick={() => setExpandedProductId(expandedProductId === product.id ? null : product.id)}
                              >
                                {product.name}
                              </td>
                              <PermissionGuard permission="seeBuyingPrice">
                                <td className="px-6 py-4 text-gray-600">৳{product.buyingPrice.toFixed(2)}</td>
                              </PermissionGuard>
                              <td className="px-6 py-4 text-gray-600">৳{product.sellingPrice.toFixed(2)}</td>
                              <PermissionGuard permission="seeBuyingPrice">
                                <td className="px-6 py-4 font-bold text-green-600">
                                  ৳{(product.sellingPrice - product.buyingPrice).toFixed(2)}
                                </td>
                              </PermissionGuard>
                              <td className="px-6 py-4">
                                {product.websiteLink ? (
                                  <a 
                                    href={product.websiteLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline flex items-center gap-1"
                                  >
                                    Link <ExternalLink size={12} />
                                  </a>
                                ) : '-'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-3 text-gray-400">
                                  <button 
                                    onClick={() => openEditModal(product)}
                                    className="hover:text-blue-600 transition-colors"
                                  >
                                    <Edit2 size={18} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteProduct(product.id)}
                                    className="hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {expandedProductId === product.id && (
                              <tr>
                                <td colSpan={6} className="px-6 py-8 bg-gray-50 border-b border-gray-200">
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="space-y-8"
                                  >
                                    {/* Price Details */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                      <PermissionGuard permission="seeBuyingPrice">
                                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Buying Price</span>
                                          <p className="text-xl font-bold text-gray-900">৳{product.buyingPrice.toFixed(2)}</p>
                                        </div>
                                      </PermissionGuard>
                                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Selling Price</span>
                                        <p className="text-xl font-bold text-gray-900">৳{product.sellingPrice.toFixed(2)}</p>
                                      </div>
                                      <PermissionGuard permission="seeBuyingPrice">
                                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Net Margin</span>
                                          <p className="text-xl font-bold text-green-600">৳{(product.sellingPrice - product.buyingPrice).toFixed(2)}</p>
                                        </div>
                                      </PermissionGuard>
                                    </div>
                                    
                                    {/* Video Section */}
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Video size={18} className="text-blue-600" />
                                          <h4 className="font-bold text-gray-900">Product Video Previews</h4>
                                        </div>
                                        <span className="text-xs text-gray-400">{(product.videos || []).length} videos added</span>
                                      </div>

                                      <div className="flex gap-2">
                                        <input 
                                          type="text" 
                                          value={newVideoUrl}
                                          onChange={(e) => setNewVideoUrl(e.target.value)}
                                          className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                          placeholder="Paste Facebook, Instagram, or Drive link here..."
                                          onKeyDown={(e) => e.key === 'Enter' && handleAddProductVideo(product.id)}
                                        />
                                        <button 
                                          onClick={() => handleAddProductVideo(product.id)}
                                          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                                        >
                                          <Plus size={18} />
                                          Add Link
                                        </button>
                                      </div>
                                      
                                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {(product.videos || []).map((video) => (
                                          <div key={video.id} className="relative group aspect-square bg-gray-200 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                                            {video.thumbnail && video.thumbnail !== 'failed' ? (
                                              <img 
                                                src={video.thumbnail} 
                                                alt="Thumbnail" 
                                                className="w-full h-full object-cover"
                                                referrerPolicy="no-referrer"
                                              />
                                            ) : video.thumbnail === 'failed' ? (
                                              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                                                <Video size={24} className="mb-1 opacity-20" />
                                                <span className="text-[8px] font-bold uppercase">Preview Unavailable</span>
                                              </div>
                                            ) : (
                                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <Loader2 size={24} className="animate-spin opacity-20" />
                                              </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]">
                                              <button 
                                                onClick={() => setSelectedVideoUrl(video.url)}
                                                className="p-2.5 bg-white rounded-full text-blue-600 hover:scale-110 transition-transform shadow-lg"
                                              >
                                                <Play size={18} fill="currentColor" />
                                              </button>
                                              <button 
                                                onClick={() => handleDeleteProductVideo(product.id, video.id)}
                                                className="p-2.5 bg-white rounded-full text-red-600 hover:scale-110 transition-transform shadow-lg"
                                              >
                                                <Trash2 size={18} />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                        {/* Empty state for videos */}
                                        {(product.videos || []).length === 0 && (
                                          <div className="col-span-full py-8 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                                            <Video size={32} className="mb-2 opacity-10" />
                                            <p className="text-xs italic">No videos added yet. Add links above to see previews.</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : activeTab === 'content-plan' ? (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold">Content Plan</h2>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={handleImportCSV}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg flex items-center gap-2 text-sm sm:text-base font-medium transition-colors shadow-sm whitespace-nowrap">
                      <Upload size={18} />
                      Import Excel/CSV
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="flex border-b border-gray-100">
                    <button 
                      onClick={() => setContentSubTab('calendar')}
                      className={`flex-1 py-4 text-sm font-bold transition-colors border-b-2 ${contentSubTab === 'calendar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                      Monthly Calendar ({contentPlan.length})
                    </button>
                    <button 
                      onClick={() => setContentSubTab('ideas')}
                      className={`flex-1 py-4 text-sm font-bold transition-colors border-b-2 ${contentSubTab === 'ideas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                      Product Ideas Board (0)
                    </button>
                  </div>

                  <div className="p-6">
                    {contentSubTab === 'calendar' ? (
                      contentPlan.length === 0 ? (
                        <div className="py-20 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-400">
                          <Layout size={48} className="mb-4 opacity-20" />
                          <h4 className="font-bold text-lg text-gray-900 mb-2">No imported posts yet</h4>
                          <p className="text-sm max-w-xs text-center mb-6">Import your monthly content plan from an Excel or CSV file. Ensure your columns have headers like "Date", "Type", "Theme", "Visual Description", and "Caption".</p>
                          <div className="relative">
                            <input 
                              type="file" 
                              accept=".csv" 
                              onChange={handleImportCSV}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-bold transition-colors shadow-md">
                              <Upload size={18} />
                              Import Excel/CSV
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="space-y-4">
                            {contentPlan.map((item) => (
                              <motion.div 
                                layout
                                key={item.id}
                                className={`p-6 rounded-2xl border transition-all ${item.isDone ? 'bg-gray-50 border-gray-100 opacity-75' : 'bg-white border-gray-200 shadow-sm'}`}
                              >
                                <div className="flex gap-6">
                                  <div className="flex flex-col items-center pt-1">
                                    <button 
                                      onClick={() => toggleContentDone(item.id)}
                                      className={`transition-colors ${item.isDone ? 'text-green-500' : 'text-gray-300 hover:text-blue-500'}`}
                                    >
                                      {item.isDone ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                                    </button>
                                  </div>
                                  
                                  <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
                                    <div className="lg:col-span-3 space-y-3">
                                      <div className="flex items-center gap-2 text-gray-900 font-bold">
                                        <Calendar size={16} className="text-gray-400" />
                                        <span>{item.date}</span>
                                      </div>
                                      <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full">
                                        {item.type}
                                      </span>
                                      <p className="font-bold text-gray-900">{item.theme}</p>
                                    </div>

                                    <div className="lg:col-span-4 space-y-2">
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Visual Description</span>
                                      <p className="text-sm text-gray-600 leading-relaxed">{item.visualDescription}</p>
                                    </div>

                                    <div className="lg:col-span-5 space-y-2 relative group">
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Copy Caption</span>
                                        <div className="flex items-center gap-2">
                                          <button 
                                            onClick={() => copyToClipboard(item.caption)}
                                            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition-colors flex items-center gap-1 text-xs font-bold"
                                          >
                                            <Copy size={14} /> Copy
                                          </button>
                                          <button className="p-1.5 hover:bg-gray-100 text-gray-400 rounded-md transition-colors">
                                            <Edit2 size={14} />
                                          </button>
                                          <button 
                                            onClick={() => deleteContentItem(item.id)}
                                            className="p-1.5 hover:bg-red-50 text-red-400 rounded-md transition-colors"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-600 leading-relaxed">
                                        {item.caption}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>

                          <div className="pt-8 border-t border-gray-100 flex justify-between items-center">
                            <div className="flex items-center gap-2 text-gray-400">
                              <CheckCircle2 size={20} />
                              <span className="text-sm font-medium">Select All</span>
                            </div>
                            <button 
                              onClick={handleArchivePlan}
                              className="flex items-center gap-2 px-6 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-bold hover:bg-gray-50 transition-colors shadow-sm"
                            >
                              <Archive size={18} />
                              Complete & Next Month
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                        <Sparkles size={48} className="mb-4 opacity-20" />
                        <p className="text-sm italic">Product Ideas Board is empty.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : activeTab === 'ads-plan' ? (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold">Ads Plan</h2>
                    <p className="text-xs sm:text-sm text-gray-500">Manage your ad campaigns across platforms</p>
                  </div>
                  <button 
                    onClick={() => setIsImportAdModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg flex items-center gap-2 text-sm sm:text-base font-medium transition-colors shadow-sm whitespace-nowrap"
                  >
                    <Plus size={18} />
                    Import Product
                  </button>
                </div>

                {/* Platform Tabs */}
                <div className="flex bg-white p-1 rounded-xl border border-gray-200 w-fit overflow-x-auto max-w-full">
                  {(['facebook', 'tiktok', 'google'] as const).map((platform) => (
                    <button
                      key={platform}
                      onClick={() => setAdPlatform(platform)}
                      className={`px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold capitalize transition-all whitespace-nowrap ${adPlatform === platform ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>

                {/* Ads List */}
                <div className="space-y-4">
                  {adProducts
                    .filter(ap => ap.platform === adPlatform)
                    .sort((a, b) => {
                      const order = { 'Live Ad': 0, 'Ready for Ad': 1, 'Pending': 2, 'Stopped': 3 };
                      return (order[a.status] ?? 99) - (order[b.status] ?? 99);
                    })
                    .map((ad) => {
                      const product = products.find(p => p.id === ad.productId);
                      const isExpanded = expandedAdId === ad.id;

                      return (
                        <motion.div 
                          layout
                          key={ad.id}
                          className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                        >
                          <div 
                            className="p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
                            onClick={() => setExpandedAdId(isExpanded ? null : ad.id)}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                                <Video size={18} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-bold text-sm sm:text-base truncate text-gray-900">{ad.name}</h3>
                                  <span className="text-[10px] sm:text-xs text-gray-400 font-medium">{ad.videos.length} Videos</span>
                                  {product?.websiteLink && (
                                    <a 
                                      href={product.websiteLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-[10px] sm:text-xs text-blue-500 hover:underline flex items-center gap-1"
                                    >
                                      View Product <ExternalLink size={10} />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-4">
                              {/* Date Display (beside status button) */}
                              {(ad.status === 'Live Ad' || ad.status === 'Stopped') && (
                                <div className="hidden md:flex flex-col items-center justify-center text-[10px] text-gray-400 font-medium leading-tight px-3 border-l border-gray-100">
                                  {ad.startTime && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-green-500 font-bold">Start:</span>
                                      {new Date(ad.startTime).toLocaleDateString()}
                                    </div>
                                  )}
                                  {ad.endTime && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-red-500 font-bold">Stop:</span>
                                      {new Date(ad.endTime).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <select 
                                  value={ad.status}
                                  onChange={(e) => handleStatusChange(ad.id, e.target.value as AdStatus)}
                                  className={`appearance-none pl-3 pr-8 py-1 sm:py-1.5 rounded-full border text-[10px] sm:text-xs font-bold outline-none focus:ring-2 cursor-pointer transition-colors ${
                                    ad.status === 'Pending' ? 'bg-orange-50 text-orange-700 border-orange-100 focus:ring-orange-100' :
                                    ad.status === 'Ready for Ad' ? 'bg-blue-50 text-blue-700 border-blue-100 focus:ring-blue-100' :
                                    ad.status === 'Live Ad' ? 'bg-green-50 text-green-700 border-green-100 focus:ring-green-100' :
                                    ad.status === 'Stopped' ? 'bg-red-50 text-red-700 border-red-100 focus:ring-red-100' :
                                    'bg-gray-50 text-gray-700 border-gray-100 focus:ring-gray-100'
                                  }`}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Ready for Ad">Ready for Ad</option>
                                  <option value="Live Ad">Live Ad</option>
                                  <option value="Stopped">Stopped</option>
                                </select>
                                <ChevronDown size={12} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                                  ad.status === 'Pending' ? 'text-orange-400' :
                                  ad.status === 'Ready for Ad' ? 'text-blue-400' :
                                  ad.status === 'Live Ad' ? 'text-green-400' :
                                  ad.status === 'Stopped' ? 'text-red-400' :
                                  'text-gray-400'
                                }`} />
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedAdId(isExpanded ? null : ad.id);
                                }}
                                className="p-1 hover:bg-gray-100 rounded-md transition-colors text-gray-400"
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (ad.status === 'Live Ad') {
                                    toast.error("Live ads cannot be deleted.");
                                    return;
                                  }
                                  
                                  if (ad.status === 'Stopped' && ad.endTime) {
                                    const endDate = new Date(ad.endTime);
                                    const now = new Date();
                                    const isSameMonth = now.getMonth() === endDate.getMonth() && now.getFullYear() === endDate.getFullYear();
                                    if (isSameMonth) {
                                      toast.error("Stopped ads can only be deleted from the next month.");
                                      return;
                                    }
                                  }
                                  
                                  deleteAdProduct(ad.id);
                                }}
                                disabled={ad.status === 'Live Ad'}
                                className={cn(
                                  "p-1 rounded-md transition-colors",
                                  ad.status === 'Live Ad' ? "text-gray-200 cursor-not-allowed" : "hover:bg-red-50 text-red-400"
                                )}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-gray-100"
                              >
                                <div className="p-4 sm:p-5 space-y-5">
                                  {/* Videos Section */}
                                  <div className="space-y-3">
                                    <div className="flex gap-2">
                                      <input 
                                        type="url"
                                        placeholder={
                                          adPlatform === 'facebook' ? "Paste Facebook or Instagram link here..." :
                                          adPlatform === 'tiktok' ? "Paste Tiktok video link or Drive link here..." :
                                          "Paste Google Drive link here..."
                                        }
                                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-100"
                                        value={newVideoUrl}
                                        onChange={(e) => setNewVideoUrl(e.target.value)}
                                      />
                                      <button 
                                        onClick={() => handleAddVideo(ad.id)}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-xs sm:text-sm hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                                      >
                                        <Plus size={16} /> Add Video
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                      {ad.videos.map((video) => {
                                        const isFacebook = video.url.includes('facebook.com') || video.url.includes('fb.watch') || video.url.includes('instagram.com');
                                        const isTiktok = video.url.includes('tiktok.com');
                                        const isDrive = video.url.includes('drive.google.com');
                                        const isYoutube = video.url.includes('youtube.com') || video.url.includes('youtu.be');
                                        const isDirectVideo = video.url.match(/\.(mp4|webm|ogg|mov)$/i);
                                        
                                        const youtubeId = isYoutube ? video.url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([^\?&"'>]+)/)?.[1] : null;

                                        return (
                                          <div key={video.id} className="relative group aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-sm transition-all hover:shadow-md">
                                            {/* Video Content / Thumbnail */}
                                            <div className="absolute inset-0 z-0">
                                              {isYoutube && youtubeId ? (
                                                <div className="w-full h-full pointer-events-none overflow-hidden">
                                                  <iframe 
                                                    src={`https://www.youtube.com/embed/${youtubeId}?controls=0&mute=1&loop=1&playlist=${youtubeId}&modestbranding=1&showinfo=0&rel=0`}
                                                    className="w-full h-full border-0 scale-[2] origin-center"
                                                    allow="autoplay"
                                                  />
                                                </div>
                                              ) : isDirectVideo ? (
                                                <video 
                                                  src={video.url} 
                                                  className="w-full h-full object-cover"
                                                  muted
                                                  preload="metadata"
                                                  onMouseOver={e => e.currentTarget.play()}
                                                  onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                                />
                                              ) : video.thumbnail && video.thumbnail !== 'failed' ? (
                                                <img 
                                                  src={video.thumbnail} 
                                                  alt="Video preview" 
                                                  className="w-full h-full object-cover"
                                                  referrerPolicy="no-referrer"
                                                />
                                              ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                                                  <div className="relative">
                                                    {isFacebook && <div className="text-blue-600 font-black text-[10px] tracking-tighter opacity-20">META</div>}
                                                    {isTiktok && <div className="text-black font-black text-[10px] tracking-tighter opacity-20">TIKTOK</div>}
                                                    {isDrive && <div className="text-yellow-600 font-black text-[10px] tracking-tighter opacity-20">DRIVE</div>}
                                                    {!isFacebook && !isTiktok && !isDrive && !isYoutube && <Video size={32} className="text-gray-200" />}
                                                  </div>
                                                  <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-400 font-medium">
                                                    {video.thumbnail === 'failed' ? (
                                                      <span>Preview Unavailable</span>
                                                    ) : (
                                                      <>
                                                        <Loader2 size={10} className="animate-spin" />
                                                        <span>Fetching Preview...</span>
                                                      </>
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                            </div>

                                            {/* Play Overlay */}
                                            <button 
                                              className="absolute inset-0 z-10 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-all"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedVideoUrl(video.url);
                                              }}
                                            >
                                              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform">
                                                <div className="w-10 h-10 rounded-full bg-white/40 flex items-center justify-center">
                                                  <Play size={24} className="text-white ml-1" fill="white" />
                                                </div>
                                              </div>
                                            </button>

                                            {/* Platform Badge */}
                                            <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-[8px] font-bold text-white uppercase tracking-wider">
                                              {isFacebook ? 'Meta' : isTiktok ? 'TikTok' : isYoutube ? 'YouTube' : isDrive ? 'Drive' : 'Video'}
                                            </div>

                                            {/* Delete Button */}
                                            <div className="absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button 
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  handleDeleteVideo(ad.id, video.id);
                                                }}
                                                className="p-1.5 bg-white/90 rounded-lg text-red-500 hover:bg-red-50 shadow-sm border border-red-100"
                                              >
                                                <Trash2 size={12} />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="h-px bg-gray-100" />

                                  {/* Notes Section */}
                                  <div className="space-y-3">
                                    <h4 className="font-bold text-xs flex items-center gap-2 text-blue-900">
                                      <MessageSquare size={14} />
                                      Add Note / Feedback
                                    </h4>
                                    <div className="flex gap-2">
                                      <input 
                                        type="text"
                                        placeholder="Type a note or feedback for this product..."
                                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-100"
                                        value={newNoteText}
                                        onChange={(e) => setNewNoteText(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddNote(ad.id)}
                                      />
                                      <button 
                                        onClick={() => handleAddNote(ad.id)}
                                        className="px-3 py-2 border border-gray-200 rounded-lg font-bold text-xs sm:text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                                      >
                                        Add Note
                                      </button>
                                    </div>
                                    <div className="space-y-1.5">
                                      {ad.notes.map((note) => (
                                        <div key={note.id} className="p-2.5 bg-green-50/20 rounded-lg border border-green-100/50 flex justify-between items-center group">
                                          <p className="text-xs text-gray-700">{note.text}</p>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">{note.createdAt}</span>
                                            <div className="w-4 h-4 rounded-full border border-green-200 flex items-center justify-center text-green-500 bg-white">
                                              <CheckCircle2 size={10} />
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  
                  {adProducts.filter(ap => ap.platform === adPlatform).length === 0 && (
                    <div className="py-20 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-400">
                      <Megaphone size={48} className="mb-4 opacity-20" />
                      <h4 className="font-bold text-lg text-gray-900 mb-2">No ad products for {adPlatform}</h4>
                      <p className="text-sm max-w-xs text-center mb-6">Import products from your inventory to start planning your ad campaigns.</p>
                      <button 
                        onClick={() => setIsImportAdModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-bold transition-colors shadow-md"
                      >
                        <Plus size={18} />
                        Import Product
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'settings' ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
                    <p className="text-sm text-gray-500">Manage your profile, team members, and access levels</p>
                  </div>
                  
                  {/* Settings Tabs - Fully Responsive */}
                  <div className="flex overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0">
                    <div className="flex gap-2 p-1 bg-gray-100/50 rounded-xl border border-gray-200 w-fit whitespace-nowrap">
                      <button
                        onClick={() => setSettingsSubTab('profile')}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                          settingsSubTab === 'profile' 
                            ? "bg-white text-blue-600 shadow-sm border border-gray-200" 
                            : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                        )}
                      >
                        <UserIcon size={16} />
                        Profile
                      </button>
                      <PermissionGuard permission="manageUsers">
                        <button
                          onClick={() => setSettingsSubTab('users')}
                          className={cn(
                            "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                            settingsSubTab === 'users' 
                              ? "bg-white text-blue-600 shadow-sm border border-gray-200" 
                              : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                          )}
                        >
                          <Users size={16} />
                          Users
                        </button>
                        <button
                          onClick={() => setSettingsSubTab('roles')}
                          className={cn(
                            "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                            settingsSubTab === 'roles' 
                              ? "bg-white text-blue-600 shadow-sm border border-gray-200" 
                              : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                          )}
                        >
                          <Shield size={16} />
                          Roles & Permissions
                        </button>
                        <button
                          onClick={() => setSettingsSubTab('devices')}
                          className={cn(
                            "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                            settingsSubTab === 'devices' 
                              ? "bg-white text-blue-600 shadow-sm border border-gray-200" 
                              : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                          )}
                        >
                          <Smartphone size={16} />
                          Devices
                        </button>
                      </PermissionGuard>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {settingsSubTab === 'profile' && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-gray-100 bg-gray-50/30">
                        <h3 className="font-bold text-lg text-gray-900">Your Profile</h3>
                        <p className="text-xs text-gray-500">Manage your personal information and security</p>
                      </div>
                      <div className="p-6 space-y-8">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                          <div className="relative group">
                            <div className="w-24 h-24 rounded-3xl bg-blue-50 flex items-center justify-center text-blue-600 overflow-hidden border-4 border-white shadow-xl ring-1 ring-gray-100">
                              {profile?.profileImage ? (
                                <img src={profile.profileImage} alt="Profile" className="w-full h-full object-cover" />
                              ) : (
                                <UserIcon size={40} />
                              )}
                            </div>
                            <label className="absolute -bottom-2 -right-2 p-2 bg-blue-600 text-white rounded-xl shadow-lg cursor-pointer hover:bg-blue-700 transition-all hover:scale-110 active:scale-95">
                              <Camera size={16} />
                              <input type="file" className="hidden" accept="image/*" onChange={handleProfileImageChange} />
                            </label>
                          </div>
                          <div className="text-center sm:text-left">
                            <h3 className="font-bold text-xl text-gray-900">{profile?.name}</h3>
                            <p className="text-sm text-gray-500">{profile?.email}</p>
                            <div className="flex justify-center sm:justify-start gap-2 mt-2">
                              <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase tracking-wider border border-blue-100">
                                {role?.name}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
                            <input 
                              type="text" 
                              value={profileForm.name}
                              onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email Address</label>
                            <input 
                              type="email" 
                              value={profile?.email || ''}
                              disabled
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed outline-none font-medium"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">New Password</label>
                            <input 
                              type="password" 
                              placeholder="Leave blank to keep current"
                              value={profileForm.password}
                              onChange={(e) => setProfileForm(prev => ({ ...prev, password: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Confirm Password</label>
                            <input 
                              type="password" 
                              placeholder="Confirm new password"
                              value={profileForm.confirmPassword}
                              onChange={(e) => setProfileForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                            />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                          <button 
                            onClick={handleUpdateProfile}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-200 active:scale-95"
                          >
                            Save Profile Changes
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsSubTab === 'users' && (
                    <PermissionGuard permission="manageUsers">
                      <div className="space-y-6">
                        {/* Users List Card */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                              <h3 className="font-bold text-lg text-gray-900">User Management</h3>
                              <p className="text-xs text-gray-500">Manage team members and their access levels</p>
                            </div>
                            <button 
                              onClick={() => {
                                setEditingUser({ name: '', email: '', password: '', roleId: '' } as any);
                                setIsUserModalOpen(true);
                              }}
                              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all shadow-md active:scale-95"
                            >
                              <Plus size={18} />
                              Add New User
                            </button>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">User Details</th>
                                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role</th>
                                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {users.map((u) => (
                                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 text-sm font-bold border border-blue-100">
                                          {u.profileImage ? (
                                            <img src={u.profileImage} alt="" className="w-full h-full object-cover rounded-xl" />
                                          ) : (
                                            u.name.charAt(0)
                                          )}
                                        </div>
                                        <div>
                                          <p className="font-bold text-sm text-gray-900">{u.name}</p>
                                          <p className="text-xs text-gray-400">{u.email}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4">
                                      <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-lg uppercase tracking-wider border border-gray-200">
                                        {roles.find(r => r.id === u.roleId)?.name || 'User'}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex justify-end gap-2">
                                        <button 
                                          onClick={() => {
                                            setEditingUser(u);
                                            setIsUserModalOpen(true);
                                          }}
                                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                          title="Edit User"
                                        >
                                          <Edit2 size={16} />
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteUser(u.id)}
                                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                          title="Delete User"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </PermissionGuard>
                  )}

                  {settingsSubTab === 'roles' && (
                    <PermissionGuard permission="manageUsers">
                      <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                              <h3 className="font-bold text-lg text-gray-900">Roles & Permissions</h3>
                              <p className="text-xs text-gray-500">Define what team members can see and do</p>
                            </div>
                            <button 
                              onClick={() => {
                                setEditingRole({ name: '', permissions: {
                                  viewProducts: true,
                                  seeBuyingPrice: false,
                                  editProducts: false,
                                  viewContentPlan: true,
                                  editContentPlan: false,
                                  viewAdsPlan: true,
                                  editAdsPlan: false,
                                  manageUsers: false
                                } } as any);
                                setIsRoleModalOpen(true);
                              }}
                              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all shadow-md active:scale-95"
                            >
                              <Plus size={18} />
                              Create New Role
                            </button>
                          </div>
                          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {roles.map((r) => (
                              <div key={r.id} className="p-5 border border-gray-100 rounded-2xl bg-gray-50/50 hover:border-blue-200 hover:bg-white transition-all group relative">
                                <div className="flex justify-between items-start mb-4">
                                  <div className="p-2 bg-white rounded-xl border border-gray-100 text-blue-600 shadow-sm">
                                    <Shield size={20} />
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => {
                                        setEditingRole(r);
                                        setIsRoleModalOpen(true);
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteRole(r.id)}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                <h4 className="font-bold text-gray-900 mb-1">{r.name}</h4>
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-4">
                                  {Object.values(r.permissions || {}).filter(Boolean).length} Permissions Active
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(r.permissions || {})
                                    .filter(([_, val]) => val)
                                    .slice(0, 3)
                                    .map(([key]) => (
                                      <span key={key} className="px-2 py-0.5 bg-white border border-gray-100 text-[9px] text-gray-500 rounded-md capitalize">
                                        {key.replace(/([A-Z])/g, ' $1').trim()}
                                      </span>
                                    ))}
                                  {Object.values(r.permissions || {}).filter(Boolean).length > 3 && (
                                    <span className="px-2 py-0.5 bg-white border border-gray-100 text-[9px] text-gray-500 rounded-md">
                                      +{Object.values(r.permissions || {}).filter(Boolean).length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </PermissionGuard>
                  )}

                  {settingsSubTab === 'devices' && (
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <ShieldAlert size={20} className="text-orange-500" />
                          Pending Device Approvals
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {deviceRequests.filter(r => r.status === 'pending').length === 0 ? (
                            <p className="text-sm text-gray-400 italic py-8 text-center border-2 border-dashed border-gray-100 rounded-2xl col-span-full">
                              No pending device requests.
                            </p>
                          ) : (
                            deviceRequests.filter(r => r.status === 'pending').map((request) => (
                              <div key={request.id} className="p-4 border border-orange-100 bg-orange-50/30 rounded-xl flex justify-between items-center">
                                <div>
                                  <p className="font-bold text-sm text-gray-900">{request.deviceName || 'Unknown Device'}</p>
                                  <p className="text-xs text-gray-500">User: {users.find(u => u.id === request.userId)?.name}</p>
                                  <p className="text-[10px] text-gray-400 mt-1">{new Date(request.requestedAt?.toDate()).toLocaleString()}</p>
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleApproveDevice(request.id)}
                                    className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                  >
                                    <Check size={16} />
                                  </button>
                                  <button 
                                    onClick={() => handleRejectDevice(request.id)}
                                    className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <ShieldCheck size={20} className="text-green-500" />
                          Recently Approved Devices
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {deviceRequests.filter(r => r.status === 'approved').slice(0, 6).map((request) => (
                            <div key={request.id} className="p-4 border border-gray-100 rounded-xl flex items-center gap-3">
                              <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                                <Smartphone size={18} />
                              </div>
                              <div>
                                <p className="font-bold text-xs text-gray-900">{request.deviceName}</p>
                                <p className="text-[10px] text-gray-500">{users.find(u => u.id === request.userId)?.name}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>
      <AnimatePresence>
        {isUserModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsUserModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingUser?.id ? 'Edit User' : 'Add New User'}</h3>
                <button onClick={() => setIsUserModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Full Name</label>
                  <input 
                    type="text"
                    placeholder="John Doe"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    value={editingUser?.name || ''}
                    onChange={(e) => setEditingUser(prev => ({ ...prev, name: e.target.value } as any))}
                  />
                </div>
                {!editingUser?.id && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Email Address</label>
                      <input 
                        type="email"
                        placeholder="john@example.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        value={editingUser?.email || ''}
                        onChange={(e) => setEditingUser(prev => ({ ...prev, email: e.target.value } as any))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Password</label>
                      <input 
                        type="password"
                        placeholder="Min 6 characters"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        value={editingUser?.password || ''}
                        onChange={(e) => setEditingUser(prev => ({ ...prev, password: e.target.value } as any))}
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Assign Role</label>
                  <select 
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                    value={editingUser?.roleId || ''}
                    onChange={(e) => setEditingUser(prev => ({ ...prev, roleId: e.target.value } as any))}
                  >
                    <option value="">Select a role</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-6 bg-gray-50 flex gap-3">
                <button 
                  onClick={() => setIsUserModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (editingUser?.id) {
                      await handleSaveUser(editingUser);
                    } else {
                      if (!editingUser?.email || !editingUser?.password || !editingUser?.roleId || !editingUser?.name) {
                        toast.error('Please fill all fields');
                        return;
                      }
                      await handleSaveUser({
                        name: editingUser.name,
                        email: editingUser.email,
                        password: editingUser.password,
                        roleId: editingUser.roleId
                      });
                    }
                    setIsUserModalOpen(false);
                  }}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  {editingUser?.id ? 'Update User' : 'Create User'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isRoleModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsRoleModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingRole?.id ? 'Edit Role' : 'Create New Role'}</h3>
                <button onClick={() => setIsRoleModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Role Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Content Manager"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    value={editingRole?.name || ''}
                    onChange={(e) => setEditingRole(prev => ({ ...prev, name: e.target.value, permissions: prev?.permissions || {} } as any))}
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Permissions</label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { key: 'viewProducts', label: 'View Products' },
                      { key: 'seeBuyingPrice', label: 'See Buying Price' },
                      { key: 'editProducts', label: 'Edit Products' },
                      { key: 'viewContentPlan', label: 'View Content Plan' },
                      { key: 'editContentPlan', label: 'Edit Content Plan' },
                      { key: 'viewAdsPlan', label: 'View Ads Plan' },
                      { key: 'editAdsPlan', label: 'Edit Ads Plan' },
                      { key: 'manageUsers', label: 'Manage Users' },
                    ].map((perm) => (
                      <div key={perm.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-sm font-bold text-gray-700">{perm.label}</span>
                        <button
                          onClick={() => {
                            const currentPerms = editingRole?.permissions || {};
                            setEditingRole(prev => ({
                              ...prev!,
                              permissions: {
                                ...currentPerms,
                                [perm.key]: !currentPerms[perm.key as keyof Role['permissions']]
                              }
                            }));
                          }}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative",
                            editingRole?.permissions?.[perm.key as keyof Role['permissions']] ? "bg-blue-600" : "bg-gray-200"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                            editingRole?.permissions?.[perm.key as keyof Role['permissions']] ? "left-7" : "left-1"
                          )} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 flex gap-3">
                <button 
                  onClick={() => setIsRoleModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (!editingRole?.name) {
                      toast.error('Role name is required');
                      return;
                    }
                    await handleSaveRole(editingRole);
                    setIsRoleModalOpen(false);
                  }}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  {editingRole?.id ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingProductId ? 'Edit Product' : 'Add Product'}</h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Product Name */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Product Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Wireless Earbuds"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  />
                </div>

                {/* Prices Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <PermissionGuard permission="seeBuyingPrice">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Buying Price (৳)</label>
                      <input 
                        type="number"
                        placeholder="0.00"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                        value={newProduct.buyingPrice}
                        onChange={(e) => setNewProduct({...newProduct, buyingPrice: e.target.value})}
                      />
                    </div>
                  </PermissionGuard>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Selling Price (৳)</label>
                    <input 
                      type="number"
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                      value={newProduct.sellingPrice}
                      onChange={(e) => setNewProduct({...newProduct, sellingPrice: e.target.value})}
                    />
                  </div>
                </div>

                {/* Website Link */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Product Website Link</label>
                  <div className="flex gap-2">
                    <input 
                      type="url"
                      placeholder="https://example.com/product"
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                      value={newProduct.websiteLink}
                      onChange={(e) => setNewProduct({...newProduct, websiteLink: e.target.value})}
                    />
                    <button 
                      onClick={fetchProductInfo}
                      disabled={isFetching || !newProduct.websiteLink}
                      className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {isFetching ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} className="text-blue-500" />}
                      Fetch Info
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button 
                  onClick={closeModal}
                  className="px-6 py-2.5 rounded-lg border border-gray-200 font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveProduct}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-md"
                >
                  {editingProductId ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Ad Modal */}
      <AnimatePresence>
        {isImportAdModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsImportAdModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-600 text-white">
                <h3 className="text-xl font-bold">Import Product to Ads Plan</h3>
                <button onClick={() => setIsImportAdModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <p className="text-sm text-gray-500">Select a product to add to your {adPlatform} ads plan.</p>
                <div className="grid grid-cols-1 gap-3">
                  {products.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                      <Package className="mx-auto text-gray-300 mb-3" size={48} />
                      <p className="text-gray-500 font-medium">No products found</p>
                      <p className="text-xs text-gray-400 mt-1">Add products first in the Products tab</p>
                    </div>
                  ) : (
                    products.map(product => {
                      const alreadyImported = adProducts.some(ap => ap.productId === product.id && ap.platform === adPlatform);
                      return (
                        <button
                          key={product.id}
                          disabled={alreadyImported}
                          onClick={() => handleImportToAds(product)}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border transition-all text-left group",
                            alreadyImported 
                              ? "bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed" 
                              : "bg-white border-gray-200 hover:border-blue-400 hover:shadow-md active:scale-[0.98]"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                              <Package size={24} />
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-900">{product.name}</h4>
                              <p className="text-xs text-gray-500">Selling Price: ${product.sellingPrice}</p>
                            </div>
                          </div>
                          {alreadyImported ? (
                            <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Already Imported</span>
                          ) : (
                            <ChevronRight className="text-gray-300 group-hover:text-blue-500 transition-colors" size={20} />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-100 bg-gray-50">
                <button 
                  onClick={() => setIsImportAdModalOpen(false)}
                  className="w-full px-6 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Video Preview Modal */}
      <AnimatePresence>
        {selectedVideoUrl && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => setSelectedVideoUrl(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-black rounded-2xl shadow-2xl w-full max-w-5xl aspect-video relative z-10 overflow-hidden border border-white/10"
            >
              <button 
                onClick={() => setSelectedVideoUrl(null)}
                className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-sm border border-white/10"
              >
                <X size={24} />
              </button>
              
              <div className="w-full h-full flex items-center justify-center">
                {selectedVideoUrl.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                  <video 
                    src={selectedVideoUrl} 
                    controls 
                    autoPlay 
                    className="max-w-full max-h-full"
                  />
                ) : selectedVideoUrl.includes('drive.google.com') ? (
                  <iframe 
                    src={selectedVideoUrl.replace('/view', '/preview')} 
                    className="w-full h-full border-0"
                    allow="autoplay"
                  />
                ) : (
                  <iframe 
                    src={getEmbedUrl(selectedVideoUrl)} 
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                )}
              </div>

              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-between">
                  <p className="text-white/60 text-xs truncate max-w-[70%]">{selectedVideoUrl}</p>
                  <a 
                    href={selectedVideoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-xs font-bold flex items-center gap-1"
                  >
                    Open Original <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


