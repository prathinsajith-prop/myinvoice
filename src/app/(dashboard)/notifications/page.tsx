"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  FileText,
  CreditCard,
  UserPlus,
  AlertTriangle,
  Info,
  Clock,
  Filter,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";

type NotificationType =
  | "GENERAL"
  | "INVOICE_CREATED"
  | "INVOICE_SENT"
  | "INVOICE_VIEWED"
  | "INVOICE_PAID"
  | "INVOICE_OVERDUE"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_REMINDER"
  | "QUOTE_ACCEPTED"
  | "QUOTE_REJECTED"
  | "CUSTOMER_ADDED"
  | "TEAM_INVITE"
  | "SYSTEM_UPDATE"
  | "SECURITY_ALERT";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

const notificationIcons: Record<NotificationType, React.ElementType> = {
  GENERAL: Info,
  INVOICE_CREATED: FileText,
  INVOICE_SENT: FileText,
  INVOICE_VIEWED: FileText,
  INVOICE_PAID: CreditCard,
  INVOICE_OVERDUE: AlertTriangle,
  PAYMENT_RECEIVED: CreditCard,
  PAYMENT_REMINDER: Clock,
  QUOTE_ACCEPTED: Check,
  QUOTE_REJECTED: AlertTriangle,
  CUSTOMER_ADDED: UserPlus,
  TEAM_INVITE: UserPlus,
  SYSTEM_UPDATE: Info,
  SECURITY_ALERT: AlertTriangle,
};

const notificationColors: Record<NotificationType, string> = {
  GENERAL: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  INVOICE_CREATED: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400",
  INVOICE_SENT: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400",
  INVOICE_VIEWED: "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400",
  INVOICE_PAID: "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400",
  INVOICE_OVERDUE: "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400",
  PAYMENT_RECEIVED: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400",
  PAYMENT_REMINDER: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400",
  QUOTE_ACCEPTED: "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400",
  QUOTE_REJECTED: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
  CUSTOMER_ADDED: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-400",
  TEAM_INVITE: "bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-400",
  SYSTEM_UPDATE: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400",
  SECURITY_ALERT: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
};

type FilterType = "all" | "unread" | "read";

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const limit = 20;

  const fetchNotifications = useCallback(
    async (reset = false) => {
      try {
        if (reset) {
          setLoading(true);
          setOffset(0);
        }

        const currentOffset = reset ? 0 : offset;
        const unreadOnly = filter === "unread";
        const res = await fetch(
          `/api/notifications?limit=${limit}&offset=${currentOffset}${unreadOnly ? "&unreadOnly=true" : ""
          }`
        );

        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();

        if (reset) {
          setNotifications(
            filter === "read"
              ? data.notifications.filter((n: Notification) => n.isRead)
              : data.notifications
          );
        } else {
          setNotifications((prev) => {
            const newNotifications =
              filter === "read"
                ? data.notifications.filter((n: Notification) => n.isRead)
                : data.notifications;
            return [...prev, ...newNotifications];
          });
        }

        setTotal(data.total);
        setUnreadCount(data.unreadCount);
        setHasMore(data.hasMore);
      } catch {
        toast.error("Failed to load notifications");
      } finally {
        setLoading(false);
      }
    },
    [offset, filter]
  );

  useEffect(() => {
    fetchNotifications(true);
  }, [filter, fetchNotifications]);

  const handleLoadMore = () => {
    setOffset((prev) => prev + limit);
    fetchNotifications();
  };

  const handleSelectNotification = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedIds(new Set(notifications.map((n) => n.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleMarkAsRead = async (ids?: string[]) => {
    const idsToMark = ids || Array.from(selectedIds);
    if (idsToMark.length === 0) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: idsToMark }),
      });

      if (!res.ok) throw new Error("Failed to update");

      setNotifications((prev) =>
        prev.map((n) =>
          idsToMark.includes(n.id)
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - idsToMark.length));
      setSelectedIds(new Set());
      setSelectAll(false);
      toast.success("Marked as read");
    } catch {
      toast.error("Failed to mark as read");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });

      if (!res.ok) throw new Error("Failed to update");

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: idsToDelete }),
      });

      if (!res.ok) throw new Error("Failed to delete");

      const deletedUnreadCount = notifications.filter(
        (n) => idsToDelete.includes(n.id) && !n.isRead
      ).length;

      setNotifications((prev) => prev.filter((n) => !idsToDelete.includes(n.id)));
      setTotal((prev) => prev - idsToDelete.length);
      setUnreadCount((prev) => Math.max(0, prev - deletedUnreadCount));
      setSelectedIds(new Set());
      setSelectAll(false);
      setDeleteDialogOpen(false);
      toast.success("Notifications deleted");
    } catch {
      toast.error("Failed to delete notifications");
    } finally {
      setActionLoading(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.isRead) {
      handleMarkAsRead([notification.id]);
    }

    // Navigate to action URL if exists
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 py-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-4 rounded-lg border p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>Notifications</CardTitle>
              {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount} unread</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNotifications(true)}
                disabled={actionLoading}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={actionLoading}
                >
                  <CheckCheck className="mr-2 h-4 w-4" />
                  Mark all read
                </Button>
              )}
            </div>
          </div>
          <CardDescription>
            {total === 0
              ? "No notifications yet"
              : `${total} notification${total !== 1 ? "s" : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters and Actions */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={filter}
                onValueChange={(v) => setFilter(v as FilterType)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMarkAsRead()}
                  disabled={actionLoading}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Mark read
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={actionLoading}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            )}
          </div>

          {/* Select All */}
          {notifications.length > 0 && (
            <div className="mb-4 flex items-center gap-2 border-b pb-3">
              <Checkbox
                id="select-all"
                checked={selectAll}
                onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
              />
              <Label
                htmlFor="select-all"
                className="text-sm text-muted-foreground font-normal"
              >
                Select all
              </Label>
            </div>
          )}

          {/* Notifications List */}
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BellOff className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-medium">No notifications</h3>
              <p className="text-sm text-muted-foreground">
                {filter === "unread"
                  ? "You're all caught up!"
                  : "You don't have any notifications yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type] || Info;
                const colorClass =
                  notificationColors[notification.type] || notificationColors.GENERAL;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 transition-colors",
                      notification.isRead
                        ? "bg-background"
                        : "bg-muted/50 border-primary/20",
                      notification.actionUrl &&
                      "cursor-pointer hover:bg-accent/50"
                    )}
                    onClick={() =>
                      notification.actionUrl &&
                      handleNotificationClick(notification)
                    }
                  >
                    <Checkbox
                      checked={selectedIds.has(notification.id)}
                      onCheckedChange={(checked) =>
                        handleSelectNotification(notification.id, checked as boolean)
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className={cn("rounded-full p-2", colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={cn(
                            "text-sm",
                            notification.isRead ? "font-normal" : "font-semibold"
                          )}
                        >
                          {notification.title}
                        </h4>
                        {!notification.isRead && (
                          <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                        {notification.readAt && (
                          <span className="flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Read{" "}
                            {format(
                              new Date(notification.readAt),
                              "MMM d, h:mm a"
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notifications</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} notification
              {selectedIds.size !== 1 ? "s" : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
