import "@fortawesome/fontawesome-free/css/all.css";
import "./css/bootstrap.scss";
import "./css/openfusion-behavior.scss";
import "./css/openfusion-layout.scss";
import "./css/openfusion-theming.scss";
import TitleBar from "./components/TitleBar";
import { LanguageProvider } from "./i18n";
import LanguageSwitcher from "./components/LanguageSwitcher";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-bs-theme="dark">
      <body>
        <LanguageProvider>
          <TitleBar />
          <LanguageSwitcher />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
