import { fetchOpenMeteoWeather } from "@/lib/data/adapters/open-meteo";
import type { WeatherHour } from "@/lib/data/types";
import { findAlertWindow, type AlertWindow } from "@/lib/alerts/evaluate";
import { resendConfigured, sendEmail } from "@/lib/alerts/resend";
import {
  claimDelivery,
  dropPushSubscription,
  finishDelivery,
  listDueAlerts,
  listPushSubscriptions,
  markChecked,
  type WeatherAlert,
} from "@/lib/alerts/store";
import { sendPush, vapidConfigured } from "@/lib/alerts/webpush";
import { SITE_URL } from "@/lib/site";
import { findSport } from "@/lib/sports";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function alertMessage(alert: WeatherAlert, window: AlertWindow, name: string) {
  const sport = findSport(alert.sportId).name.toLowerCase();
  const when = `${window.dayLabel.toLowerCase()} ${window.label}`;
  const title = `${window.dayLabel} ${window.label}: goed om te ${sport === "outdoorfitness" ? "sporten" : sport}`;
  const facts = [
    `${Math.round(window.hour.temperatureC)} °C`,
    `wind ${Math.round(window.hour.windKmh)} km/u`,
    `regenkans ${Math.round(window.hour.precipitationProbability)}%`,
    window.hour.uvIndex !== null ? `UV ${Math.round(window.hour.uvIndex)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const url = `${SITE_URL}/?sport=${alert.sportId}#planner`;
  const unsubscribeUrl = `${SITE_URL}/meldingen/uit?token=${alert.unsubscribeToken}`;
  const manageUrl = `${SITE_URL}/account/meldingen`;
  const pushBody = `${alert.placeLabel}: score ${window.score}/100. ${facts}.`;
  const subject = `${findSport(alert.sportId).name} in ${alert.placeLabel}: ${when} scoort ${window.score}`;
  const text = [
    `Hoi ${name},`,
    "",
    `${findSport(alert.sportId).name} in ${alert.placeLabel}: ${when} scoort ${window.score} van 100.`,
    `Het weer op dat moment: ${facts}.`,
    "",
    `Bekijk het volledige advies: ${url}`,
    "",
    "Dit is een advies, geen veiligheidsgarantie. Kijk bij twijfel op knmi.nl.",
    `Meldingen aanpassen: ${manageUrl}`,
    `Deze melding uitzetten: ${unsubscribeUrl}`,
  ].join("\n");
  const html = `<!doctype html><html lang="nl"><body style="margin:0;background:#f4f8f6;font-family:Arial,Helvetica,sans-serif;color:#0b2530">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden">
    <tr><td style="background:#0b2530;padding:20px 24px;color:#ffffff;font-size:20px;font-weight:800">WeerSport.</td></tr>
    <tr><td style="padding:24px">
      <p style="margin:0 0 6px;color:#1f6b70;font-weight:700">${escapeHtml(findSport(alert.sportId).name)} in ${escapeHtml(alert.placeLabel)}</p>
      <p style="margin:0;font-size:30px;font-weight:800;line-height:1.1">${escapeHtml(window.dayLabel)} ${escapeHtml(window.label)}</p>
      <p style="margin:12px 0 0;display:inline-block;background:#d6fa63;border-radius:12px;padding:8px 12px;font-weight:800">Score ${window.score} van 100</p>
      <p style="margin:16px 0 0;color:#537079">Het weer op dat moment: ${escapeHtml(facts)}.</p>
      <p style="margin:20px 0 0"><a href="${url}" style="display:inline-block;background:#0b2530;color:#ffffff;text-decoration:none;font-weight:700;border-radius:14px;padding:12px 18px">Bekijk het volledige advies</a></p>
      <p style="margin:20px 0 0;font-size:13px;color:#537079">Dit is een advies, geen veiligheidsgarantie. Kijk bij twijfel naar de waarschuwingen op knmi.nl.</p>
    </td></tr>
    <tr><td style="padding:16px 24px;border-top:1px solid #dde7e3;font-size:12px;color:#537079">
      Je krijgt deze mail omdat je een melding hebt aangezet. <a href="${manageUrl}" style="color:#1f6b70">Meldingen aanpassen</a> · <a href="${unsubscribeUrl}" style="color:#1f6b70">Deze melding uitzetten</a>
    </td></tr>
  </table></td></tr></table></body></html>`;
  return {
    subject,
    text,
    html,
    unsubscribeUrl: `${SITE_URL}/api/alerts/unsubscribe?token=${alert.unsubscribeToken}`,
    push: { title, body: pushBody, url, tag: `alert-${alert.id}` },
  };
}

export type RunSummary = { alerts: number; places: number; matched: number; emailed: number; pushed: number; errors: string[] };

/** Daily job: one forecast per place, then email and/or push for every alert with a qualifying window. */
export async function runAlerts(now = new Date()): Promise<RunSummary> {
  const due = listDueAlerts();
  const summary: RunSummary = { alerts: due.length, places: 0, matched: 0, emailed: 0, pushed: 0, errors: [] };
  const forecasts = new Map<string, Promise<WeatherHour[] | null>>();
  const forecastFor = (alert: WeatherAlert) => {
    const key = `${alert.latitude.toFixed(2)},${alert.longitude.toFixed(2)}`;
    if (!forecasts.has(key)) {
      forecasts.set(
        key,
        fetchOpenMeteoWeather({ latitude: alert.latitude, longitude: alert.longitude, placeLabel: alert.placeLabel }).then((pair) =>
          pair.weather.status === "READY" ? (pair.weather.value?.hours ?? null) : null,
        ),
      );
    }
    return forecasts.get(key)!;
  };

  for (const { alert, email, name } of due) {
    const hours = await forecastFor(alert);
    if (!hours) {
      summary.errors.push(`Geen verwachting voor ${alert.placeLabel}`);
      continue;
    }
    const window = findAlertWindow({ sportId: alert.sportId, hours, minScore: alert.minScore, days: alert.days, now });
    if (!window) {
      markChecked(alert.id, false);
      continue;
    }
    summary.matched += 1;
    const message = alertMessage(alert, window, name);
    let sent = false;

    if (alert.email && resendConfigured() && claimDelivery(alert.id, window.date, window.label, "email")) {
      const result = await sendEmail({ to: email, subject: message.subject, html: message.html, text: message.text, unsubscribeUrl: message.unsubscribeUrl });
      finishDelivery(alert.id, window.date, "email", result.ok ? "sent" : "failed", result.ok ? result.id : result.error);
      if (result.ok) {
        summary.emailed += 1;
        sent = true;
      } else summary.errors.push(`Mail ${alert.id}: ${result.error}`);
    }

    if (alert.push && vapidConfigured() && claimDelivery(alert.id, window.date, window.label, "push")) {
      const subscriptions = listPushSubscriptions(alert.userId);
      let delivered = 0;
      for (const subscription of subscriptions) {
        const result = await sendPush(subscription, message.push);
        if (result.ok) delivered += 1;
        else if (result.gone) dropPushSubscription(subscription.endpoint);
        else summary.errors.push(`Push ${alert.id}: ${result.error}`);
      }
      finishDelivery(alert.id, window.date, "push", delivered > 0 ? "sent" : "failed", `${delivered}/${subscriptions.length}`);
      if (delivered > 0) {
        summary.pushed += 1;
        sent = true;
      }
    }
    markChecked(alert.id, sent);
  }
  summary.places = forecasts.size;
  return summary;
}
