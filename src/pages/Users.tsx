import { useState, useEffect, useMemo } from "react";
import {
    Users as UsersIcon,
    UserPlus,
    Search,
    X,
    Edit,
    Trash2,
    Shield,
    Mail,
    Calendar,
    CheckCircle,
    Loader2,
    MoreVertical,
    Check,
    AlertCircle,
    Eye,
    EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { usersAPI } from "@/services/api";
import { cn } from "@/lib/utils";

interface User {
    id: number;
    username: string;
    role: string;
    full_name: string;
    profile_picture?: string;
    created_at: string;
}

export default function Users() {
    const { toast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
        username: "",
        password: "",
        full_name: "",
        role: "encoder",
    });

    const roles = [
        { value: "encoder", label: "Encoder", color: "bg-blue-100 text-blue-700 border-blue-200" },
        { value: "approver", label: "Approver", color: "bg-amber-100 text-amber-700 border-amber-200" },
        { value: "administrator", label: "Administrator", color: "bg-purple-100 text-purple-700 border-purple-200" },
    ];

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await usersAPI.getAllUsers();
            setUsers(Array.isArray(data) ? data : []);
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.error || "Failed to fetch users",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async () => {
        if (!formData.username || !formData.password || !formData.full_name) {
            toast({
                title: "Validation Error",
                description: "Please fill in all required fields",
                variant: "destructive",
            });
            return;
        }

        try {
            setSubmitting(true);
            await usersAPI.createUser(formData);
            toast({
                title: "Success",
                description: "User created successfully",
            });
            setIsCreateDialogOpen(false);
            setFormData({ username: "", password: "", full_name: "", role: "encoder" });
            fetchUsers();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.error || "Failed to create user",
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateUser = async () => {
        if (!selectedUser) return;
        if (!formData.username || !formData.full_name) {
            toast({
                title: "Validation Error",
                description: "Username and Full Name are required",
                variant: "destructive",
            });
            return;
        }

        try {
            setSubmitting(true);
            await usersAPI.updateUser(selectedUser.id, {
                username: formData.username,
                full_name: formData.full_name,
                role: formData.role,
            });
            toast({
                title: "Success",
                description: "User updated successfully",
            });
            setIsEditDialogOpen(false);
            fetchUsers();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.error || "Failed to update user",
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!selectedUser) return;

        try {
            setSubmitting(true);
            await usersAPI.deleteUser(selectedUser.id);
            toast({
                title: "Success",
                description: "User deleted successfully",
            });
            setIsDeleteDialogOpen(false);
            fetchUsers();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.error || "Failed to delete user",
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const filteredUsers = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return users.filter(u =>
            u.username.toLowerCase().includes(q) ||
            u.full_name.toLowerCase().includes(q) ||
            u.role.toLowerCase().includes(q)
        );
    }, [users, searchQuery]);

    const openEditDialog = (user: User) => {
        setSelectedUser(user);
        setFormData({
            username: user.username,
            password: "", // Don't show password
            full_name: user.full_name,
            role: user.role,
        });
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (user: User) => {
        setSelectedUser(user);
        setIsDeleteDialogOpen(true);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 lg:p-8 space-y-8">
            {/* Header Section */}
            <div className="relative rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-6 lg:p-10 overflow-hidden shadow-2xl shadow-indigo-200">
                <div className="absolute inset-0 bg-grid-white/10 opacity-20"></div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md border border-white/30">
                                <UsersIcon className="w-6 h-6 text-white" />
                            </div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-white">
                                User Management
                            </h1>
                        </div>
                        <p className="text-indigo-100/90 text-sm max-w-xl font-medium">
                            Create, manage, and monitor system users. Control access levels and oversee user accounts.
                        </p>
                    </div>

                    <Button
                        onClick={() => setIsCreateDialogOpen(true)}
                        className="bg-white text-indigo-700 hover:bg-indigo-50 shadow-xl shadow-black/10 gap-2 font-bold px-6 h-12 rounded-xl transition-all hover:scale-105 active:scale-95"
                    >
                        <UserPlus className="w-5 h-5" />
                        Create New User
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white/80 backdrop-blur-sm">
                <CardHeader className="border-b border-slate-100 px-6 py-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg font-bold text-slate-900">Registered Users</CardTitle>
                            <CardDescription className="text-slate-500 font-medium mt-0.5">
                                Total of {users.length} accounts in the system
                            </CardDescription>
                        </div>

                        <div className="relative w-full md:w-80 group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                            <Input
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search users by name, username..."
                                className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus:border-indigo-500 rounded-xl transition-all"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="relative">
                                <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                                <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping"></div>
                            </div>
                            <p className="text-slate-500 font-bold animate-pulse">Fetching users...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="border-b-2 border-slate-100">
                                        <TableHead className="py-4 px-6 font-bold text-slate-700">User</TableHead>
                                        <TableHead className="py-4 px-6 font-bold text-slate-700">Username</TableHead>
                                        <TableHead className="py-4 px-6 font-bold text-slate-700">Role</TableHead>
                                        <TableHead className="py-4 px-6 font-bold text-slate-700">Date Created</TableHead>
                                        <TableHead className="py-4 px-6 font-bold text-slate-700 text-center">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-20 text-center">
                                                <div className="space-y-3">
                                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto grayscale opacity-50">
                                                        <UsersIcon className="w-8 h-8 text-slate-400" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <h3 className="text-lg font-bold text-slate-900">No users found</h3>
                                                        <p className="text-slate-500 text-sm">Try adjusting your search query</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredUsers.map((user) => (
                                            <TableRow key={user.id} className="hover:bg-slate-50 group transition-colors border-b border-slate-100">
                                                <TableCell className="py-4 px-6">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="w-10 h-10 border-2 border-white shadow-sm ring-1 ring-slate-100">
                                                            {user.profile_picture ? (
                                                                <AvatarImage src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}${user.profile_picture}`} />
                                                            ) : null}
                                                            <AvatarFallback className="bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 font-bold text-xs uppercase">
                                                                {user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : '??'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-800">{user.full_name}</span>
                                                            <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                                                                ID: {user.id}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-4 px-6 font-medium text-slate-600">
                                                    @{user.username}
                                                </TableCell>
                                                <TableCell className="py-4 px-6">
                                                    <Badge className={cn(
                                                        "px-3 py-1 rounded-lg border shadow-none font-bold text-[10px] uppercase tracking-wider",
                                                        roles.find(r => r.value === user.role)?.color || "bg-slate-100 text-slate-600"
                                                    )}>
                                                        {roles.find(r => r.value === user.role)?.label || user.role}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-4 px-6 text-sm text-slate-500 font-medium">
                                                    {new Date(user.created_at).toLocaleDateString('en-PH', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </TableCell>
                                                <TableCell className="py-4 px-6">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => openEditDialog(user)}
                                                            className="w-9 h-9 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-slate-100 hover:border-indigo-100"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => openDeleteDialog(user)}
                                                            className="w-9 h-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all border border-slate-100 hover:border-rose-100"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create User Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl p-0 overflow-hidden bg-white">
                    <DialogHeader className="p-6 bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <UserPlus className="w-5 h-5" />
                            Create New User
                        </DialogTitle>
                        <DialogDescription className="text-indigo-100/80 font-medium">
                            Add a new staff member to the system
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</Label>
                            <Input
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                placeholder="Enter full name"
                                className="rounded-xl border-slate-200 h-11"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Username</Label>
                                <Input
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="e.g. jdoe"
                                    className="rounded-xl border-slate-200 h-11"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Role</Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={(val) => setFormData({ ...formData, role: val })}
                                >
                                    <SelectTrigger className="rounded-xl border-slate-200 h-11">
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-xl">
                                        <SelectItem value="encoder">Encoder</SelectItem>
                                        <SelectItem value="approver">Approver</SelectItem>
                                        <SelectItem value="administrator">Administrator</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</Label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="Create password"
                                    className="rounded-xl border-slate-200 h-11 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100 flex-row gap-2 sm:justify-end">
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="rounded-xl flex-1 sm:flex-none border-slate-200">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateUser}
                            disabled={submitting}
                            className="rounded-xl flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create User"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl p-0 overflow-hidden bg-white">
                    <DialogHeader className="p-6 bg-gradient-to-r from-amber-500 to-amber-600 text-white">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Edit className="w-5 h-5" />
                            Edit User Details
                        </DialogTitle>
                        <DialogDescription className="text-amber-100/80 font-medium">
                            Update information for @{selectedUser?.username}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</Label>
                            <Input
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                className="rounded-xl border-slate-200 h-11"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Username</Label>
                                <Input
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="rounded-xl border-slate-200 h-11"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Role</Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={(val) => setFormData({ ...formData, role: val })}
                                >
                                    <SelectTrigger className="rounded-xl border-slate-200 h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-xl">
                                        <SelectItem value="encoder">Encoder</SelectItem>
                                        <SelectItem value="approver">Approver</SelectItem>
                                        <SelectItem value="administrator">Administrator</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <p className="text-[10px] text-amber-800 font-medium leading-tight">
                                Password can only be changed by the user in their own settings for security reasons.
                            </p>
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100 flex-row gap-2 sm:justify-end">
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl flex-1 sm:flex-none border-slate-200">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdateUser}
                            disabled={submitting}
                            className="rounded-xl flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700 text-white min-w-[120px]"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete User Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
                    <AlertDialogHeader>
                        <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
                            <Trash2 className="w-6 h-6 text-rose-600" />
                        </div>
                        <AlertDialogTitle className="text-xl font-bold text-slate-900">Delete user account?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500 font-medium">
                            Are you sure you want to delete <span className="font-bold text-slate-900">{selectedUser?.full_name}</span>?
                            This action cannot be undone and the user will lose all access to the system.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl border-slate-200">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteUser}
                            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200"
                            disabled={submitting}
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Account"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
