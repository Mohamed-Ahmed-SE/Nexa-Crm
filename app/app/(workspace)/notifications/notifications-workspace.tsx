"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  loadNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/notifications/actions";
import type { Notification } from "@/lib/notifications/repository";
import { useDateFormat } from "@/components/auth/date-format-provider";
import { formatCalendarDateTime } from "@/lib/preferences/date-format";

export function NotificationsWorkspace() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    try {
      const result = await loadNotificationsAction(now.getTimezoneOffset(), tomorrow.getTimezoneOffset());
      if (result.ok) setNotifications(result.notifications ?? []);
      else setError(result.message);
    } catch {
      setError("Notifications could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);

  const unreadCount = notifications.filter(({ read_at }) => !read_at).length;

  function markRead(notificationId: string) {
    setNotice("");
    startTransition(async () => {
      const result = await markNotificationReadAction(notificationId);
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, read_at: new Date().toISOString() } : item));
    });
  }

  function markAllRead() {
    setNotice("");
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? readAt })));
    });
  }

  return (
    <div className="page-container notifications-page">
      <header className="notifications-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-description">Keep up with assignments, follow-ups, and workspace activity.</p>
        </div>
        {unreadCount > 0 && <button className="notifications-action" disabled={pending || loading} onClick={markAllRead} type="button">Mark all as read</button>}
      </header>
      {notice && <p className="notifications-notice" role="status">{notice}</p>}
      {loading ? (
        <section aria-busy="true" aria-label="Notifications" className="notifications-list">
          <p className="notifications-loading" role="status">Loading notifications…</p>
        </section>
      ) : error ? (
        <section className="notifications-error" role="alert"><h2>Notifications could not be loaded</h2><p>{error}</p><button className="notifications-action" onClick={() => void loadNotifications()} type="button">Try again</button></section>
      ) : notifications.length ? (
        <section aria-label="Notifications" className="notifications-list">
          <p className="notifications-summary" aria-live="polite">{unreadCount ? `${unreadCount} unread` : "You’re all caught up"}</p>
          <ul>
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} pending={pending} onMarkRead={markRead} />
            ))}
          </ul>
        </section>
      ) : (
        <section className="notifications-empty">
          <h2>You’re all caught up</h2>
          <p>New assignments, task reminders, and workspace updates will appear here.</p>
        </section>
      )}
    </div>
  );
}

function NotificationItem({ notification, pending, onMarkRead }: {
  notification: Notification;
  pending: boolean;
  onMarkRead: (notificationId: string) => void;
}) {
  const dateFormat = useDateFormat();
  const date = formatCalendarDateTime(notification.created_at, dateFormat);
  const recordLabel = notification.related_entity_type
    ? `Open ${notification.related_entity_type}`
    : notification.task_id ? "Open task" : null;

  return (
    <li className={`notification-item${notification.read_at ? " is-read" : " is-unread"}`}>
      <div className="notification-copy">
        <strong className="notification-title">{notification.title}</strong>
        <p>{notification.message}</p>
        <time dateTime={notification.created_at}>{date}</time>
      </div>
      <div className="notification-controls">
        {notification.href && recordLabel && <Link aria-label={recordLabel} className="notification-link" href={notification.href}>Open record</Link>}
        {!notification.read_at && <button aria-label={`Mark ${notification.title.toLowerCase()} as read`} className="notifications-action notification-read-action" disabled={pending} onClick={() => onMarkRead(notification.id)} type="button">Mark read</button>}
      </div>
    </li>
  );
}
