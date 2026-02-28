import './globals.css';

export const metadata = {
  title: 'Näsby Park Tracker – Husk-P',
  description: 'Interaktiv bostadsbevakning för Näsby Park, Täby',
};

export default function RootLayout({ children }) {
  return (
    <html lang="sv">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
