const { Expo } = require('expo-server-sdk');
const PushToken = require('../models/PushToken');
const Notification = require('../models/Notification');

const expo = new Expo();

async function enviarNotificacion(userId, { titulo, cuerpo, tipo = 'general' }) {
  // Guardar en BD
  await Notification.create({ user: userId, titulo, cuerpo, tipo });

  // Obtener tokens del usuario
  const tokens = await PushToken.find({ user: userId });
  if (!tokens.length) return;

  const messages = tokens
    .filter(t => Expo.isExpoPushToken(t.token))
    .map(t => ({
      to: t.token,
      sound: 'default',
      title: titulo,
      body: cuerpo,
      data: { tipo },
    }));

  if (!messages.length) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error('Error enviando push:', error);
    }
  }
}

async function enviarNotificacionMasiva(userIds, { titulo, cuerpo, tipo = 'general' }) {
  for (const userId of userIds) {
    await enviarNotificacion(userId, { titulo, cuerpo, tipo });
  }
}

module.exports = { enviarNotificacion, enviarNotificacionMasiva };
