import type { RequestHandler } from 'express';
import { isHttpError } from '../../middlewares/error.ts';
import * as notificationService from '../../services/notificationService.ts';
import * as homeService from '../../services/homeService.ts';
import type { INotification } from '../../models/notification.ts';

/** Notificaciones del usuario agrupadas por hogar (más recientes primero). */
interface NotifGroup {
  homeId: string;
  homeName: string;
  items: INotification[];
}

/** Reparte las notificaciones en grupos por hogar conservando el orden. */
const buildGroups = (
  homes: { id: string; name: string }[],
  notifications: INotification[]
): NotifGroup[] => {
  const nameById = new Map(homes.map((h) => [h.id, h.name] as const));
  const groups: NotifGroup[] = [];
  const indexOf = new Map<string, number>();
  for (const n of notifications) {
    const homeId = n.homeId.toString();
    let idx = indexOf.get(homeId);
    if (idx === undefined) {
      idx = groups.length;
      indexOf.set(homeId, idx);
      groups.push({ homeId, homeName: nameById.get(homeId) ?? 'Hogar no disponible', items: [] });
    }
    groups[idx].items.push(n);
  }
  return groups;
};

// Página global de notificaciones (agrupada por hogar) con badge de no leídas.
export const index: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!._id;
    const [notifications, unreadCount] = await Promise.all([
      notificationService.listNotifications(userId),
      notificationService.countUnread(userId),
    ]);
    const homes = await homeService.listHomesForUser(req.user!);
    res.render('notifications/index', {
      title: 'Notificaciones',
      groups: buildGroups(homes, notifications),
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
};

/** Marca una como leída (solo las propias) y vuelve a la lista. */
export const read: RequestHandler = async (req, res, next) => {
  try {
    await notificationService.markRead(req.user!._id, req.params.id as string);
    res.redirect('/notifications?success=' + encodeURIComponent('Notificación marcada como leída'));
  } catch (err) {
    if (isHttpError(err) && err.status === 404) {
      return res.redirect(
        '/notifications?error=' + encodeURIComponent('Notificación no encontrada')
      );
    }
    next(err);
  }
};

/** Marca todas las no leídas del usuario como leídas. */
export const readAll: RequestHandler = async (req, res, next) => {
  try {
    const count = await notificationService.markAllRead(req.user!._id);
    res.redirect(
      '/notifications?success=' +
        encodeURIComponent(count === 1 ? '1 notificación marcada' : `${count} notificaciones marcadas`)
    );
  } catch (err) {
    next(err);
  }
};
