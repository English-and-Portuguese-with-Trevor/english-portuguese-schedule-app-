import { StatusPage } from "@/components/status-page";
import { tr } from "@/i18n/translate";

export default function NotFound() {
  return (
    <StatusPage
      title={tr("Page not found")}
      message={tr("This page doesn't exist or has moved.")}
    />
  );
}
