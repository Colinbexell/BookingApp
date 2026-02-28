const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, // App Password från Google, inte ditt vanliga lösenord
  },
});

const pad2 = (n) => String(n).padStart(2, "0");

const formatDate = (date) => {
  const d = new Date(date);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const formatTime = (date) => {
  const d = new Date(date);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/**
 * Skickar bokningsbekräftelse med en bekräftelselänk till kunden
 */
const sendBookingConfirmationRequest = async ({ booking, activityTitle, confirmUrl }) => {
  const dateStr = formatDate(booking.startAt);
  const startStr = formatTime(booking.startAt);
  const endStr = formatTime(booking.endAt);

  const html = `
    <div style="font-family: sans-serif; max-width: 540px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="font-size: 22px; margin-bottom: 4px;">Bekräfta din bokning</h2>
      <p style="color: #555; margin-top: 0;">Hej ${booking.customerName}, tack för din bokning! Klicka på knappen nedan för att bekräfta.</p>

      <div style="background: #f5f5f5; border-radius: 10px; padding: 18px 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Aktivitet:</strong> ${activityTitle}</p>
        <p style="margin: 0 0 8px 0;"><strong>Datum:</strong> ${dateStr}</p>
        <p style="margin: 0 0 8px 0;"><strong>Tid:</strong> ${startStr} – ${endStr}</p>
        ${booking.totalPrice > 0 ? `<p style="margin: 0;"><strong>Totalpris:</strong> ${booking.totalPrice} ${booking.currency}</p>` : ""}
      </div>

      <a href="${confirmUrl}"
         style="display: inline-block; background: #000; color: #fff; padding: 13px 28px;
                border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">
        Bekräfta bokning
      </a>

      <p style="margin-top: 24px; font-size: 13px; color: #888;">
        Om du inte gjort denna bokning kan du ignorera detta mail.<br>
        Länken är giltig i 24 timmar.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Bexo" <${process.env.MAIL_USER}>`,
    to: booking.email,
    subject: `Bekräfta din bokning – ${activityTitle} ${dateStr}`,
    html,
  });
};

/**
 * Skickar ett bekräftat-mail efter att kunden klickat på länken
 */
const sendBookingConfirmed = async ({ booking, activityTitle }) => {
  const dateStr = formatDate(booking.startAt);
  const startStr = formatTime(booking.startAt);
  const endStr = formatTime(booking.endAt);

  const html = `
    <div style="font-family: sans-serif; max-width: 540px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="font-size: 22px; margin-bottom: 4px;">✓ Bokning bekräftad!</h2>
      <p style="color: #555; margin-top: 0;">Hej ${booking.customerName}, din bokning är nu bekräftad. Vi ser fram emot ditt besök!</p>

      <div style="background: #f5f5f5; border-radius: 10px; padding: 18px 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Aktivitet:</strong> ${activityTitle}</p>
        <p style="margin: 0 0 8px 0;"><strong>Datum:</strong> ${dateStr}</p>
        <p style="margin: 0 0 8px 0;"><strong>Tid:</strong> ${startStr} – ${endStr}</p>
        ${booking.totalPrice > 0 ? `<p style="margin: 0;"><strong>Totalpris:</strong> ${booking.totalPrice} ${booking.currency}</p>` : ""}
      </div>

      <p style="font-size: 13px; color: #888;">Spara detta mail som kvitto på din bokning.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Bexo" <${process.env.MAIL_USER}>`,
    to: booking.email,
    subject: `Bokningsbekräftelse – ${activityTitle} ${dateStr}`,
    html,
  });
};

module.exports = { sendBookingConfirmationRequest, sendBookingConfirmed };