const cron = require('node-cron');
const Credit = require('../models/Credit');
const Account = require('../models/Account');
const Movement = require('../models/Movement');
const User = require('../models/User');
const { enviarNotificacion } = require('./notificationService');

function formatCLP(n) {
  return '$' + Math.round(n).toLocaleString('es-CL');
}

// Alertas de pagos próximos — Todos los días a las 9:00 AM
function iniciarAlertaPagos() {
  cron.schedule('0 9 * * *', async () => {
    try {
      const tresDias = new Date();
      tresDias.setDate(tresDias.getDate() + 3);

      const creditos = await Credit.find({
        estado: 'al_dia',
        fechaVencimiento: { $lte: tresDias, $gte: new Date() },
      });

      for (const credito of creditos) {
        await enviarNotificacion(credito.user, {
          titulo: '📅 Pago próximo',
          cuerpo: `Tu crédito "${credito.nombre}" de ${formatCLP(credito.cuotaMensual)} vence pronto.`,
          tipo: 'pago_proximo',
        });
      }
    } catch (error) {
      console.error('Error en alerta de pagos:', error);
    }
  });
}

// Resumen semanal — Lunes a las 8:00 AM
function iniciarResumenSemanal() {
  cron.schedule('0 8 * * 1', async () => {
    try {
      const usuarios = await User.find({});
      const semanaAtras = new Date();
      semanaAtras.setDate(semanaAtras.getDate() - 7);

      for (const usuario of usuarios) {
        const movimientos = await Movement.find({
          user: usuario._id,
          postDate: { $gte: semanaAtras },
        });

        if (!movimientos.length) continue;

        const ingresos = movimientos
          .filter(m => m.amount > 0)
          .reduce((s, m) => s + m.amount, 0);
        const gastos = movimientos
          .filter(m => m.amount < 0)
          .reduce((s, m) => s + Math.abs(m.amount), 0);

        await enviarNotificacion(usuario._id, {
          titulo: '📊 Resumen semanal',
          cuerpo: `Esta semana: ${formatCLP(ingresos)} ingresos, ${formatCLP(gastos)} gastos. ${movimientos.length} movimientos.`,
          tipo: 'resumen_semanal',
        });
      }
    } catch (error) {
      console.error('Error en resumen semanal:', error);
    }
  });
}

// Alerta de salud financiera baja — Diario a las 10:00 AM
function iniciarAlertaSalud() {
  cron.schedule('0 10 * * *', async () => {
    try {
      const usuarios = await User.find({});

      for (const usuario of usuarios) {
        const cuentas = await Account.find({ user: usuario._id });
        const creditos = await Credit.find({ user: usuario._id, estado: { $ne: 'pagado' } });

        if (!cuentas.length && !creditos.length) continue;

        const saldoTotal = cuentas.reduce((s, c) => s + (c.balance?.available || c.balance?.current || 0), 0);
        const deudaTotal = creditos.reduce((s, c) => s + (c.saldoPendiente || 0), 0);
        const cuotasMensuales = creditos.reduce((s, c) => s + (c.cuotaMensual || 0), 0);

        let puntaje = 50;
        if (saldoTotal > 0) puntaje += 20;
        if (deudaTotal === 0) puntaje += 15;
        else if (saldoTotal > deudaTotal) puntaje += 10;
        if (cuotasMensuales > 0 && saldoTotal > cuotasMensuales * 3) puntaje += 15;
        const atrasados = creditos.filter(c => c.estado === 'atrasado').length;
        puntaje -= atrasados * 10;
        puntaje = Math.max(0, Math.min(100, puntaje));

        if (puntaje < 40) {
          await enviarNotificacion(usuario._id, {
            titulo: '⚠️ Salud financiera baja',
            cuerpo: `Tu puntaje de salud financiera es ${puntaje}/100. Revisa tus finanzas.`,
            tipo: 'salud_baja',
          });
        }
      }
    } catch (error) {
      console.error('Error en alerta de salud:', error);
    }
  });
}

function iniciarScheduler() {
  iniciarAlertaPagos();
  iniciarResumenSemanal();
  iniciarAlertaSalud();
  console.log('📅 Alert scheduler iniciado');
}

module.exports = { iniciarScheduler };
