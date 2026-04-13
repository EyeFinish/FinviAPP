const { Resend } = require('resend');

if (!process.env.RESEND_API_KEY) {
  console.warn('ADVERTENCIA: RESEND_API_KEY no configurada. Los emails no se enviarán.');
}

const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder');

async function enviarCodigoRecuperacion(destinatario, nombre, codigo) {
  const { error } = await resend.emails.send({
    from: `Finvi <${process.env.RESEND_FROM_EMAIL}>`,
    to: destinatario,
    subject: 'Tu código de verificación Finvi',
    html: plantillaCodigo(nombre, codigo),
  });

  if (error) {
    throw new Error(`Error enviando email: ${error.message}`);
  }
}

function plantillaCodigo(nombre, codigo) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Código de verificación</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="520" cellpadding="0" cellspacing="0"
                 style="background:#ffffff;border-radius:16px;overflow:hidden;
                        box-shadow:0 4px 24px rgba(0,0,0,0.08);">

            <!-- Header -->
            <tr>
              <td align="center" style="background:#1800ad;padding:32px 40px;">
                <h1 style="color:#ffffff;font-size:28px;margin:0;font-weight:700;letter-spacing:-0.5px;">Finvi</h1>
                <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px;">
                  Tu salud financiera en un solo lugar
                </p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 40px;">
                <p style="font-size:16px;color:#1a1a2e;margin:0 0 12px;">
                  Hola, <strong>${nombre}</strong>
                </p>
                <p style="font-size:15px;color:#555a7e;line-height:1.6;margin:0 0 28px;">
                  Recibimos una solicitud para restablecer la contraseña de tu cuenta Finvi.
                  Ingresa el siguiente código en la app para continuar:
                </p>

                <!-- Código -->
                <div style="background:#f0f0ff;border-radius:12px;padding:28px 20px;
                            text-align:center;margin-bottom:28px;">
                  <p style="font-size:42px;font-weight:700;letter-spacing:14px;
                             color:#1800ad;margin:0;font-family:monospace;">
                    ${codigo}
                  </p>
                </div>

                <p style="font-size:13px;color:#555a7e;line-height:1.6;margin:0 0 8px;">
                  Este código expirará en <strong>15 minutos</strong>.
                </p>
                <p style="font-size:13px;color:#555a7e;line-height:1.6;margin:0;">
                  Si no solicitaste este cambio, puedes ignorar este correo.
                  Tu contraseña actual seguirá siendo la misma.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f4f6fb;padding:20px 40px;border-top:1px solid #d8ddf5;">
                <p style="font-size:12px;color:#555a7e;margin:0;text-align:center;">
                  © ${new Date().getFullYear()} Finvi · Este es un correo automático, no lo respondas.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

module.exports = { enviarCodigoRecuperacion };
