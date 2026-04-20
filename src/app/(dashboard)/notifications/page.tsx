"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
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
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function groupNotificationsByDate(notifications: Notification[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const groups: { label: string; items: Notification[] }[] = [];
  const groupMap: Record<string, Notification[]> = {};

  for (const n of notifications) {
    const d = new Date(n.createdAt);
    let label: string;
    if (d >= todayStart) label = "Today";
    else if (d >= yesterdayStart) label = "Yesterday";
    else label = "Earlier";

    if (!groupMap[label]) {
      groupMap[label] = [];
      groups.push({ label, items: groupMap[label] });
    }
    groupMap[label].push(n);
  }

  return groups;
}

export default function NotificationsPage() {
  const router = useRouter();
  const t = useTranslations("notificationsPage");
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
        toast.error(t("toastFailedLoad"));
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
      toast.success(t("toastMarkedRead"));
    } catch {
      toast.error(t("toastFailedMark"));
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
      toast.success(t("toastAllRead"));
    } catch {
      toast.error(t("toastFailedMarkAll"));
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
      toast.success(t("toastDeleted"));
    } catch {
      toast.error(t("toastFailedDelete"));
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
      <div className="container mx-auto max-w-4xl space-y-4 py-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Card>
          <div className="border-b px-6 py-3">
            <Skeleton className="h-9 w-72" />
          </div>
          <CardContent className="p-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={`skel-${i}`} className="flex items-start gap-4 border-b px-6 py-4 last:border-0">
                <Skeleton className="mt-1 h-4 w-4 shrink-0 rounded" />
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full" />
                </div>
                <Skeleton className="h-3 w-20 shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const grouped = groupNotificationsByDate(notifications);

  return (
    <div className="container mx-auto max-w-4xl space-y-4 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="rounded-full px-2">
              {unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
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
              {t("markAllRead")}
            </Button>
          )}
        </div>
      </div>

      <Card>
        {/* Tab Filter */}
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as FilterType)}
          className="w-full"
        >
          <TabsList className="h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="all"
              className="rounded-none border-b-2 border-transparent px-6 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t("filterAll")}
              {total > 0 && (
                <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="unread"
              className="rounded-none border-b-2 border-transparent px-6 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t("filterUnread")}
              {unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="read"
              className="rounded-none border-b-2 border-transparent px-6 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t("filterRead")}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <CardContent className="p-0">
          {/* Bulk Toolbar */}
          {notifications.length > 0 && (
            <div
              className={cn(
                "flex items-center justify-between border-b px-6 py-2.5 transition-colors",
                selectedIds.size > 0 ? "bg-muted/40" : "bg-transparent"
              )}
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  id="select-all"
                  checked={selectAll}
                  onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                />
                <Label
                  htmlFor="select-all"
                  className="cursor-pointer text-sm font-normal text-muted-foreground"
                >
                  {selectedIds.size > 0
                    ? t("selected", { count: selectedIds.size })
                    : t("selectAll")}
                </Label>
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMarkAsRead()}
                    disabled={actionLoading}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    {t("markRead")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={actionLoading}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("delete")}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <BellOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium">{t("noNotifications")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {filter === "unread" ? t("allCaughtUp") : t("noNotificationsDesc")}
              </p>
            </div>
          ) : (
            <div>
              {grouped.map(({ label, items }) => (
                <div key={label}>
                  {/* Date group label */}
                  <div className="border-b bg-muted/20 px-6 py-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </span>
                  </div>
                  <div className="divide-y">
                    {items.map((notification) => {
                      const Icon = notificationIcons[notification.type] || Info;
                      const colorClass =
                        notificationColors[notification.type] ||
                        notificationColors.GENERAL;
                      return (
                        <div
                          key={notification.id}
                          role={notification.actionUrl ? "button" : undefined}
                          tabIndex={notification.actionUrl ? 0 : undefined}
                          className={cn(
                            "flex items-start gap-4 px-6 py-4 transition-colors",
                            "hover:bg-muted/30",
                            !notification.isRead &&
                            "border-l-2 border-l-primary bg-primary/[0.03]",
                            notification.actionUrl && "cursor-pointer"
                          )}
                          onClick={() =>
                            notification.actionUrl &&
                            handleNotificationClick(notification)
                          }
                          onKeyDown={(e) => {
                            if (
                              notification.actionUrl &&
                              (e.key === "Enter" || e.key === " ")
                            )
                              handleNotificationClick(notification);
                          }}
                        >
                          <div
                            className="mt-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={selectedIds.has(notification.id)}
                              onCheckedChange={(checked) =>
                                handleSelectNotification(
                                  notification.id,
                                  checked as boolean
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className={cn("shrink-0 rounded-full p-2", colorClass)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-4">
                              <h4
                                className={cn(
                                  "text-sm leading-5",
                                  notification.isRead ? "font-normal" : "font-semibold"
                                )}
                              >
                                {notification.title}
                              </h4>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="whitespace-nowrap text-xs text-muted-foreground">
                                  {formatDistanceToNow(
                                    new Date(notification.createdAt),
                                    { addSuffix: true }
                                  )}
                                </span>
                                {!notification.isRead && (
                                  <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                                )}
                              </div>
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                              {notification.message}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center border-t px-6 py-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("loadingMore")}
                  </>
                ) : (
                  t("loadMore")
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
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm", { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("deleting")}
                </>
              ) : (
                t("delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
