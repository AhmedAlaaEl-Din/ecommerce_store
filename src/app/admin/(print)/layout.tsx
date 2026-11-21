/** Print pages: no admin chrome. Each page calls requireAdmin() itself. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-surface flex-1 focus:outline-none print:bg-white"
    >
      {children}
    </main>
  );
}
