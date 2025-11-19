// app/layout.js
import "./global.css";

export const metadata = {
  title: "Project Database",
  description: "Consultancy projects dashboard"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
