import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Shield, Lock, Loader2, Calendar, Mail, Bell, Smartphone, Globe, Eye, EyeOff, Check, AlertCircle, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authAPI } from "@/services/api";
import { useAuth } from "@/context/AuthContext";

// Use the User type from api.ts instead of creating a new one
type ApiUser = {
  id: number;
  username: string;
  role: string;
  full_name: string;
  profile_picture?: string;
  created_at: string;
};

export default function Settings() {
  const { toast } = useToast();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [userData, setUserData] = useState<ApiUser | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    full_name: "",
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  // Password strength indicators
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUpperCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  useEffect(() => {
    if (userData) {
      setFormData(prev => ({
        ...prev,
        username: userData.username || "",
        full_name: userData.full_name || "",
      }));
    }
  }, [userData]);

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const data = await authAPI.getProfile();

      setUserData(data);
      setFormData(prev => ({
        ...prev,
        username: data.username || "",
        full_name: data.full_name || "",
      }));
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      toast({
        title: "Error",
        description: error.error || "Failed to load user data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Update password strength when new password changes
    if (field === "new_password") {
      setPasswordStrength({
        hasMinLength: value.length >= 8,
        hasUpperCase: /[A-Z]/.test(value),
        hasNumber: /[0-9]/.test(value),
        hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(value),
      });
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);

      // Build update object with only fields that have values
      const updateData: any = {};

      if (formData.full_name.trim()) {
        updateData.full_name = formData.full_name;
      }

      if (formData.username && formData.username !== userData?.username) {
        updateData.username = formData.username;
      }

      // If no fields to update, show message and return
      if (Object.keys(updateData).length === 0) {
        toast({
          title: "No changes",
          description: "No changes were made to your profile.",
        });
        return;
      }

      const data = await authAPI.updateProfile(updateData);

      toast({
        title: "Profile updated",
        description: "Your profile information has been saved successfully.",
      });

      // Update local user data
      setUserData(prev => prev ? { ...prev, ...data } : null);

      // Update auth context
      if (updateUser && data) {
        updateUser(data);
      }

    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: error.error || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    try {
      setSavingPassword(true);

      // Validation
      if (!formData.current_password) {
        toast({
          title: "Current password required",
          description: "Please enter your current password",
          variant: "destructive",
        });
        return;
      }

      if (!formData.new_password) {
        toast({
          title: "New password required",
          description: "Please enter a new password",
          variant: "destructive",
        });
        return;
      }

      // Check all password requirements
      const strengthChecks = Object.values(passwordStrength).every(Boolean);
      if (!strengthChecks) {
        toast({
          title: "Password too weak",
          description: "Please meet all password requirements",
          variant: "destructive",
        });
        return;
      }

      if (formData.new_password !== formData.confirm_password) {
        toast({
          title: "Passwords don't match",
          description: "New password and confirmation do not match",
          variant: "destructive",
        });
        return;
      }

      await authAPI.changePassword({
        currentPassword: formData.current_password,  // Change to camelCase
        newPassword: formData.new_password,          // Change to camelCase
      });

      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });

      // Reset password fields
      setFormData(prev => ({
        ...prev,
        current_password: "",
        new_password: "",
        confirm_password: "",
      }));

      // Reset password strength
      setPasswordStrength({
        hasMinLength: false,
        hasUpperCase: false,
        hasNumber: false,
        hasSpecialChar: false,
      });

    } catch (error: any) {
      console.error('Error updating password:', error);
      toast({
        title: "Error",
        description: error.error || "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please select a JPG, PNG or WebP image",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleUploadProfilePicture = async () => {
    if (!selectedFile) return;

    try {
      setUploadingPicture(true);
      const formData = new FormData();
      formData.append('profile_picture', selectedFile);

      const response = await authAPI.updateProfilePicture(formData);

      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been changed successfully.",
      });

      // Update local state and context
      if (updateUser) {
        updateUser({ profile_picture: response.profile_picture });
      }

      setUserData(prev => prev ? { ...prev, profile_picture: response.profile_picture } : null);
      setSelectedFile(null);
      // Don't clear previewUrl yet, let it be replaced by the new user profile picture
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      toast({
        title: "Upload failed",
        description: error.error || "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setUploadingPicture(false);
    }
  };

  const getProfilePictureUrl = () => {
    if (previewUrl && selectedFile) return previewUrl;

    const picturePath = userData?.profile_picture || user?.profile_picture;
    if (picturePath) {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      return `${baseUrl}${picturePath}`;
    }
    return null;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown date";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return "Unknown date";
    }
  };

  // Helper to safely get role
  const getRole = () => {
    if (userData?.role) return userData.role;
    if (user?.role) return user.role;
    return "Unknown";
  };

  // Get initials for avatar
  const getInitials = () => {
    const name = userData?.full_name || user?.full_name || "";
    if (!name) return "U";
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Calculate password strength percentage
  const getPasswordStrengthPercentage = () => {
    const checks = Object.values(passwordStrength);
    return (checks.filter(Boolean).length / checks.length) * 100;
  };

  // Get password strength color and text
  const getPasswordStrengthInfo = () => {
    const percentage = getPasswordStrengthPercentage();
    if (percentage === 0) return { color: "bg-slate-200", text: "Enter password", textColor: "text-slate-500" };
    if (percentage <= 25) return { color: "bg-red-500", text: "Very weak", textColor: "text-red-600" };
    if (percentage <= 50) return { color: "bg-orange-500", text: "Weak", textColor: "text-orange-600" };
    if (percentage <= 75) return { color: "bg-yellow-500", text: "Good", textColor: "text-yellow-600" };
    return { color: "bg-emerald-500", text: "Strong", textColor: "text-emerald-600" };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 lg:p-6 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="relative mb-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-blue-50 flex items-center justify-center animate-pulse">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
            <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping"></div>
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Loading profile</h3>
          <p className="text-sm text-slate-500">Please wait while we fetch your account information</p>
        </div>
      </div>
    );
  }

  const strengthInfo = getPasswordStrengthInfo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 lg:p-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-600/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Edit Profile</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage your account and profile preferences
            </p>
          </div>
        </div>
      </div>

      {/* User Profile Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-4 border-white shadow-xl overflow-hidden">
              {getProfilePictureUrl() ? (
                <img
                  src={getProfilePictureUrl()!}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-2xl font-semibold">
                  {getInitials()}
                </AvatarFallback>
              )}
            </Avatar>
            <label
              htmlFor="profile-upload"
              className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full"
            >
              <div className="flex flex-col items-center">
                <Camera className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-medium uppercase tracking-wider">Change</span>
              </div>
            </label>
            <input
              id="profile-upload"
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>
          <div className="flex-1 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {userData?.full_name || user?.full_name || "User"}
                </h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-0">
                    {getRole()}
                  </Badge>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-0">
                    Active
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-3">
                {selectedFile && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="text-xs h-8"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleUploadProfilePicture}
                      disabled={uploadingPicture}
                      className="text-xs h-8 bg-blue-600 hover:bg-blue-700"
                    >
                      {uploadingPicture ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                      Save Photo
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs defaultValue="profile" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border border-slate-200 p-1 rounded-xl h-auto">
          <TabsTrigger
            value="profile"
            className="rounded-lg px-5 py-2.5 text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
          >
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="rounded-lg px-5 py-2.5 text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
          >
            <Lock className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>

        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card className="border border-slate-200/80 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 px-6 py-5">
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <User className="w-4 h-4 text-blue-700" />
                </div>
                Personal Information
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Update your personal details and public profile information
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-sm font-medium text-slate-700">
                    Full name
                  </Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => handleInputChange("full_name", e.target.value)}
                    placeholder="Enter your full name"
                    className="border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 h-11 rounded-xl bg-white/50 backdrop-blur-sm transition-all"
                  />
                  <p className="text-xs text-slate-500">
                    Your full name as it appears on official documents
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium text-slate-700">
                    Username
                  </Label>
                  <div className="relative">
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => handleInputChange("username", e.target.value)}
                      placeholder={userData?.username || "Choose a username"}
                      className="border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 h-11 rounded-xl bg-white/50 backdrop-blur-sm transition-all pl-10"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <User className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    This will be your unique login identifier
                  </p>
                </div>
              </div>

              <Separator className="bg-slate-200" />


              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveProfile}
                  disabled={savingProfile || (!formData.username.trim() && !formData.full_name.trim())}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/25 rounded-xl h-11 px-6 font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving changes...
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6 mt-6">
          <Card className="border border-slate-200/80 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 px-6 py-5">
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 rounded-lg">
                  <Lock className="w-4 h-4 text-amber-700" />
                </div>
                Change Password
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Ensure your account is using a strong password to stay secure
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current_password" className="text-sm font-medium text-slate-700">
                    Current password
                  </Label>
                  <div className="relative">
                    <Input
                      id="current_password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={formData.current_password}
                      onChange={(e) => handleInputChange("current_password", e.target.value)}
                      placeholder="Enter your current password"
                      className="border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 h-11 rounded-xl bg-white/50 backdrop-blur-sm transition-all pl-10 pr-10"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Lock className="w-4 h-4 text-slate-400" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Separator className="bg-slate-200" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="new_password" className="text-sm font-medium text-slate-700">
                      New password
                    </Label>
                    <div className="relative">
                      <Input
                        id="new_password"
                        type={showNewPassword ? "text" : "password"}
                        value={formData.new_password}
                        onChange={(e) => handleInputChange("new_password", e.target.value)}
                        placeholder="Enter new password"
                        className="border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 h-11 rounded-xl bg-white/50 backdrop-blur-sm transition-all pl-10 pr-10"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Lock className="w-4 h-4 text-slate-400" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm_password" className="text-sm font-medium text-slate-700">
                      Confirm new password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm_password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={formData.confirm_password}
                        onChange={(e) => handleInputChange("confirm_password", e.target.value)}
                        placeholder="Confirm new password"
                        className="border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 h-11 rounded-xl bg-white/50 backdrop-blur-sm transition-all pl-10 pr-10"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Lock className="w-4 h-4 text-slate-400" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password strength meter */}
                {formData.new_password && (
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-700">Password strength</span>
                      <span className={`text-sm font-semibold ${strengthInfo.textColor}`}>
                        {strengthInfo.text}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-4">
                      <div
                        className={`h-full ${strengthInfo.color} transition-all duration-300 ease-out`}
                        style={{ width: `${getPasswordStrengthPercentage()}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordStrength.hasMinLength ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                          {passwordStrength.hasMinLength && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-xs text-slate-600">Min. 8 characters</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordStrength.hasUpperCase ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                          {passwordStrength.hasUpperCase && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-xs text-slate-600">Uppercase letter</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordStrength.hasNumber ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                          {passwordStrength.hasNumber && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-xs text-slate-600">Number</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordStrength.hasSpecialChar ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                          {passwordStrength.hasSpecialChar && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-xs text-slate-600">Special character</span>
                      </div>
                    </div>
                  </div>
                )}

                {formData.new_password && formData.confirm_password && formData.new_password !== formData.confirm_password && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-medium">Passwords do not match</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleUpdatePassword}
                  disabled={savingPassword || !formData.current_password || !formData.new_password || !formData.confirm_password}
                  className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg shadow-amber-600/25 rounded-xl h-11 px-6 font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {savingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating password...
                    </>
                  ) : (
                    "Update password"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}