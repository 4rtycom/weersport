import { headers } from "next/headers";
import { dataSourceStatus } from "@/lib/data/providers/health";
import { syncAuthorized } from "@/lib/data/providers/sync-guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Databronnen" };

export default async function DataSourcesPage() {
  const headerList = await headers();
  if (!syncAuthorized(headerList.get("authorization"))) {
    return (
      <main id="inhoud" className="moment">
        <h1>Databronnen</h1>
        <p>Dit overzicht is afgeschermd. Er worden geen brongegevens of sleutels getoond.</p>
      </main>
    );
  }
  const status = dataSourceStatus();
  return (
    <main id="inhoud" className="moment">
      <p className="eyebrow">Beheer</p>
      <h1>Databronnen</h1>
      <p>Flags blijven uit tot een bewuste uitrol. Een groene build is geen productiegereedheid.</p>
      <ul className="source-list">
        {Object.entries(status.flags).map(([name, enabled]) => (
          <li key={name}>
            <div>
              <strong>{name}</strong>
              <span>{enabled ? "aan" : "uit"}</span>
            </div>
          </li>
        ))}
        <li>
          <div>
            <strong>KNMI-sleutel aanwezig</strong>
            <span>{status.knmiKeyConfigured ? "ja" : "nee"}</span>
          </div>
        </li>
        <li>
          <div>
            <strong>Opslag</strong>
            <span>
              {status.persistence}. Duurzame migratie: {status.durableStore}.
            </span>
          </div>
        </li>
        {status.providers.map((provider) => (
          <li key={provider.provider}>
            <div>
              <strong>{provider.provider}</strong>
              <span>
                {provider.status}
                {provider.lastSuccessAt ? ` · laatste succes ${provider.lastSuccessAt}` : ""}
                {provider.lastPublishedAt ? ` · publicatie ${provider.lastPublishedAt}` : ""}
                {` · records ${provider.records}`}
                {provider.lastErrorCode ? ` · fout ${provider.lastErrorCode}` : ""}
              </span>
              <small>{provider.note}</small>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
